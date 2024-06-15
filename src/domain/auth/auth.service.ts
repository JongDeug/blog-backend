import database from '../../database';
import bcrypt from 'bcrypt';
import '../../loadEnv';
import jwt, { Decoded, Secret } from 'jsonwebtoken';
import { RegisterDto, LoginDto } from './dto/dto.index';
import * as process from 'node:process';
import { User } from '../../../prisma/prisma-client';

declare module 'jsonwebtoken' {
    export interface Decoded extends jwt.JwtPayload {
        id: string;
        email: string;
        type: 'refresh' | 'access';
    }
}


export class AuthService {
    async register(dto: RegisterDto) {
        // I. Email 중복 체킹
        const isExist = await database.user.findUnique({ where: { email: dto.email } });

        // I. 409 Conflict, => 만약 중복이라면 에러 체킹
        if (isExist) throw { status: 409, message: '이미 존재하는 이메일 입니다.' };

        // I. 유저 생성, bcrypt 로 비밀번호 복호화
        const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
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
        if (!user) throw { status: 404, message: '가입되지 않은 이메일 입니다.' };

        // I. 유저가 있다면 password 를 가져와서 bcrypt.compare 함수로 비교
        const isCorrect = await bcrypt.compare(dto.password!, user.password);

        // I. 400 Client Error, 만약 비밀번호가 틀리면 에러 발생
        if (!isCorrect) throw { status: 400, message: '비밀번호를 잘못 입력하셨습니다.' };

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

    // M. refresh 토큰으로 access 또는 refresh 토큰을 발급해주는 함수
    refresh(token: string, wantYouRefreshToken: boolean = false) {
        // I. token verify, 만약 검증되지 않으면 에러 발생
        const decoded = this.verifyToken(token);

        // I. 디코드된 놈이 refresh token 인지 확인하고, 만약 아니면 에러 발생
        if (decoded.type !== 'refresh') throw { status: 401, message: '토큰 재발급은 refresh 토큰으로만 가능합니다' };

        // I. 원하는 토큰 발급(access or refresh)
        return this.signToken({ ...decoded }, wantYouRefreshToken);
    }

    logout() {

    }

    /**
     * Utils
     * signToken : 토큰 서명(생성)
     * verifyToken : 토큰 검증
     * extractTokenFromHeader : 토큰 추출
     */
    signToken(user: Pick<User, 'email' | 'id'>, isRefreshToken: boolean) {
        const payload = {
            id: user.id,
            email: user.email,
            type: isRefreshToken ? 'refresh' : 'access',
        };

        return jwt.sign(payload, process.env.JWT_SECRET as Secret, {
            expiresIn: isRefreshToken ? '1d' : '2h',
        });
    }

    verifyToken(token: string) {
        try {
            return <Decoded>jwt.verify(token, process.env.JWT_SECRET as Secret);
        } catch (err) {
            // I. 401 Unauthorized
            throw { status: 401, message: '토큰이 만료됐거나 잘못된 토큰입니다' };
        }
    }

    extractTokenFromHeader(header: string | undefined) {
        // I. 헤더가 undefined 이라면
        if (!header) {
            throw { status: 401, message: '토큰을 보내고 있지 않습니다' };
        }

        // I. 헤더 split
        const splitToken = header.split(' ');

        // I. 양식에 맞지 않으면 에러 반환
        if (splitToken.length !== 2 || splitToken[0] !== 'Bearer') {
            throw { status: 401, message: '잘못된 토큰입니다' };
        }

        // I. rawToken 반환
        return splitToken[1];
    }
}
