import database from '../../database';
import bcrypt from 'bcrypt';
import '../../loadEnv';
import jwt, { Secret } from 'jsonwebtoken';
import { RegisterDto, LoginDto } from './dto/dto.index';
import * as process from 'node:process';

export class AuthService {
    async register(dto: RegisterDto) {
        // I. Email 중복 체킹 => 만약 중복이라면 에러 체킹
        const isExist = await database.user.findUnique({ where: { email: dto.email } });

        // I. 409 Conflict
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
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '2h',
        });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '1d',
        });

        return { accessToken, refreshToken };
    }

    async login(dto: LoginDto) {
        // I. user 검색
        const user = await database.user.findUnique({
            where: { email: dto.email },
        });

        // I. 만약 존재하지 않으면 throw 가입되지 않은 이메일, Record not found => null
        // I. 404 Not found
        if (!user) throw { status: 404, message: '가입되지 않은 이메일 입니다.' };

        // I. 유저가 있다면 password 를 가져와서 bcrypt.compare 함수로 비교
        const isCorrect = await bcrypt.compare(dto.password!, user.password);

        // I. 만약 틀리면 throw error
        // I. 400 Client Error
        if (!isCorrect) throw { status: 400, message: '비밀번호를 잘못 입력하셨습니다.' };

        // I. 인증이 완료되면 accessToken, refreshToken 발급
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '2h',
        });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET as Secret, {
            expiresIn: '1d',
        });

        return { accessToken, refreshToken };
    }

    async refresh() {

    }
}
