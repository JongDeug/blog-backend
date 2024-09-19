import { CustomError } from '@utils/customError';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import jwt, { Secret, VerifyOptions } from 'jsonwebtoken';
import { LoginDto, RegisterDto } from './dto';
import { User } from '../../../prisma/prisma-client';
import { CustomJwtPayload } from '@custom-type/customJwtPayload';
import redisClient from '@utils/redis';
import { REFRESH_AGE } from './const/tokenAge';

export class AuthService {
    async register(dto: RegisterDto) {
        // I. Email 중복 체킹
        const isExist = await database.user.findUnique({
            where: { email: dto.email },
        });

        // I. 409 Conflict, => 만약 중복이라면 에러 체킹
        if (isExist)
            throw new CustomError(
                409,
                'Conflict',
                '이미 존재하는 이메일 입니다'
            );

        // I. 유저 생성, bcrypt 로 비밀번호 복호화
        const hashedPwd = await bcrypt.hash(
            dto.password,
            Number(process.env.PASSWORD_SALT)
        );
        const user = await database.user.create({
            data: {
                ...dto,
                password: hashedPwd,
            },
        });

        // I. accessToken, refreshToken 발급
        const accessToken = this.signToken(user, false);
        const refreshToken = this.signToken(user, true);

        // I. Redis에 저장
        await redisClient.set(`${user.id}:${refreshToken}`, user.id, {
            EX: REFRESH_AGE,
        });
        // 아니 음.. 오.. 아.. 예..
        // redis 에 왜 저장함? => 무효화 할라고 =>

        return { accessToken, refreshToken };
    }

    async login(dto: LoginDto) {
        // I. user 검색, Record not found => null
        const user = await database.user.findUnique({
            where: { email: dto.email },
        });

        // I. 만약 존재하지 않으면 throw 가입되지 않은 이메일,
        // I. 404 Not found
        if (!user)
            throw new CustomError(
                404,
                'Not Found',
                '가입되지 않은 이메일 입니다'
            );

        // I. 유저가 있다면 password 를 가져와서 bcrypt.compare 함수로 비교
        const isCorrect = await bcrypt.compare(dto.password, user.password);

        // I. 400 Client Error, 만약 비밀번호가 틀리면 에러 발생
        if (!isCorrect)
            throw new CustomError(
                401,
                'Unauthorized',
                '비밀번호를 잘못 입력하셨습니다'
            );

        // I. 인증이 완료되면 accessToken, refreshToken 발급
        const accessToken = this.signToken(user, false);
        const refreshToken = this.signToken(user, true);

        // I. Redis에 저장
        await redisClient.set(`${user.id}:${refreshToken}`, user.id, {
            EX: REFRESH_AGE,
        });

        return {
            accessToken,
            refreshToken,
            username: user.name,
            role: user.role,
        };
    }

    // M. refresh 토큰으로 access 와 refresh 토큰을 발급해주는 함수
    async refresh(token: string) {
        // I. token verify, 만약 검증되지 않으면 에러 발생
        const decoded = this.verifyToken(token);

        // I. 디코드된 놈이 refresh token 인지 확인하고, 만약 아니면 에러 발생
        if (decoded.type !== 'refresh')
            throw new CustomError(
                401,
                'Unauthorized',
                '토큰 재발급은 refresh 토큰으로만 가능합니다'
            );

        // I. Redis에서 get, 만약 없으면 유효성 검증 실패
        const userId = await redisClient.get(`${decoded.id}:${token}`);
        // I. 만약 다르면 유효성 검증 에러
        if (decoded.id !== userId) {
            throw new CustomError(
                401,
                'Unauthorized',
                '토큰 유효성 검증에 실패했습니다'
            );
        }

        // I. refresh 토큰은 사용될 때마다 다시 rotation
        const accessToken = this.signToken({ ...decoded }, false);
        const refreshToken = this.signToken({ ...decoded }, true);

        // I. Redis에서 refresh 토큰 삭제 후 재발급
        await redisClient.del(`${decoded.id}:${token}`);
        await redisClient.set(`${decoded.id}:${refreshToken}`, decoded.id, {
            EX: REFRESH_AGE,
        });

        return { accessToken, refreshToken };
    }

    async logout(refreshToken: string) {
        // I. Redis 에서 refreshToken 제거
        await redisClient.del(refreshToken);
    }

    /**
     * Utils
     * signToken : 토큰 서명(생성)
     * verifyToken : 토큰 검증
     */
    signToken(user: Pick<User, 'email' | 'id'>, isRefreshToken: boolean) {
        const payload = {
            id: user.id,
            email: user.email,
            type: isRefreshToken ? 'refresh' : 'access',
        };

        return jwt.sign(payload, process.env.JWT_SECRET as Secret, {
            expiresIn: isRefreshToken ? '7d' : '3m',
        });
    }

    verifyToken(token: string, options: VerifyOptions = {}) {
        try {
            return <CustomJwtPayload>(
                jwt.verify(token, process.env.JWT_SECRET as Secret, options)
            );
        } catch (err) {
            if (err instanceof Error) {
                // I. 토큰은 유효한데 만료됐을 경우
                // I. error 타입 에러 => instanceof 로 해결
                if (err.name === 'TokenExpiredError') {
                    throw new CustomError(
                        401,
                        'Unauthorized',
                        '만료된 토큰입니다'
                    );
                }
            }
            // I. 토큰 자체가 유효하지 않을 경우
            throw new CustomError(401, 'Unauthorized', '잘못된 토큰입니다');
        }
    }
}
