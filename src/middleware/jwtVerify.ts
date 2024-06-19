import { RequestHandler } from 'express';
import { database } from '@utils';
import { AuthService } from '../domain/auth/auth.service';

export const jwtVerify: RequestHandler = async (req, res, next) => {
    try {
        // I. '/auth' 는 인증에서 제외한다
        if (req.url.startsWith('/auth')) return next();

        // I. cookie 에서 access token 추출, 만약 없으면 에러 반환
        if (!req.cookies['accessToken']) {
            // I. 401 Unauthorized
            return next({ status: 401, message: '토큰을 보내고 있지 않습니다' });
        }
        const accessToken = req.cookies['accessToken'];

        // I. access token 검증, 만약 검증에 실패하면 에러 반환
        const authService = new AuthService();
        const decode = authService.verifyToken(accessToken);

        // I. 검증에 성공하면 decode 된 유저 정보를 가지고 유저가 있는지 확인
        const user = await database.user.findUnique({ where: { id: decode!.id } });

        // I. 만약 유저가 없다면 에러 반환
        // I. 404 Not found
        if (!user) return next({ status: 404, message: '유저를 찾을 수 없습니다' });
        // I. 만약 유저가 있다면 req 에 유저 정보를 담음
        else req.user = user;

        // I. 에러 없이 미들웨어를 통과
        next();
    } catch (err) {
        next(err);
    }
};
