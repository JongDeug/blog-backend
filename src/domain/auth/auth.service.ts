import { CustomError } from '@utils/customError';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import jwt, { Secret, VerifyOptions } from 'jsonwebtoken';
import { LoginDto, RegisterDto } from './dto';
import { User } from '../../../prisma/prisma-client';
import { CustomJwtPayload } from '@custom-type/customJwtPayload';

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

        // I. refreshToken DB에 저장
        await database.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

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

        // I. refreshToken DB에 저장
        await database.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });

        return { accessToken, refreshToken };
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

        // I. DB 에서 해당 user 를 가져옴
        const validRefresh = await database.user.findUnique({
            where: { id: decoded.id, refreshToken: token },
        });
        // I. 만약 없거나 다르면 유효성 검증 에러
        if (!validRefresh)
            throw new CustomError(
                401,
                'Unauthorized',
                '토큰 유효성 검증에 실패했습니다'
            );

        // I. refresh 토큰은 사용될 때마다 다시 rotation
        const accessToken = this.signToken({ ...decoded }, false);
        const refreshToken = this.signToken({ ...decoded }, true);

        // I. refreshToken DB에 저장
        await database.user.update({
            where: { id: decoded.id },
            data: { refreshToken },
        });

        return { accessToken, refreshToken };
    }

    async logout(token: string) {
        // I. verify(만료일 무시함) => decode
        const decoded = this.verifyToken(token, { ignoreExpiration: true });

        // I. 만약 토큰 타입이 access 아니라면
        if (decoded.type !== 'access')
            throw new CustomError(
                401,
                'Unauthorized',
                '로그아웃은 access 토큰으로만 가능합니다'
            );

        // I. decoded 정보를 가지고 User 의 refresh field 삭제 => *유저가 없어도 에러 발생시키지 않아야 됨. // 없으면 null 반환
        // R. 데이터베이스에 직접 접근하므로 효율적이지 못함 => 나중에 Redis 활용
        const user = await database.user.findUnique({
            where: { id: decoded.id },
        });
        if (user) {
            await database.user.update({
                where: { id: decoded.id },
                data: { refreshToken: null },
            });
        }
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
            expiresIn: isRefreshToken ? '1d' : '1h',
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
