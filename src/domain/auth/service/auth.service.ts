import database from '../../../database';
import bcrypt from 'bcrypt';
import '../../../loadEnv';
import jwt, { Secret } from 'jsonwebtoken';
import { RegisterDto } from '../dto/register.dto';
import * as process from 'node:process';

export class AuthService {
    async register(dto: RegisterDto) {
        // I. Email 중복 체킹 => 만약 중복이라면 에러 체킹
        const isExist = await database.user.findUnique({ where: { email: dto.email } });

        if (isExist) throw { status: 400, message: '이미 존재하는 이메일 입니다.' };

        // I. 유저 생성, bcrypt 로 비밀번호 복호화
        const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
        const user = await database.user.create({
            data: {
                ...dto,
                password: hashedPwd,
            },
        });

        // I. accessToken, refreshToken 발급
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '2h',
        });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '2h',
        });

        return { accessToken, refreshToken };
    }
}
