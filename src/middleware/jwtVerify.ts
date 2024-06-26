import { RequestHandler } from 'express';
import { AuthService } from '../domain/auth/auth.service';
import { CustomError } from '@utils/customError';

export const jwtVerify = function(authService: AuthService): RequestHandler {
    return async function(req, res, next) {
        try {
            // I. '/auth' 는 인증에서 제외한다
            if (req.url.startsWith('/auth')) return next();

            // I. cookie 에서 access token 추출, 만약 없으면 에러 반환
            const accessToken = req.cookies.accessToken;
            if (!accessToken) {
                // I. 401 Unauthorized
                return next(new CustomError(401, 'Unauthorized', '토큰을 보내고 있지 않습니다'));
            }

            // I. access token 검증, 만약 검증에 실패하면 에러 반환
            const decoded = authService.verifyToken(accessToken);

            // I. 만약 토큰 타입이 access 아니라면
            if (decoded.type !== 'access') {
                return next(new CustomError(401, 'Unauthorized', '서비스 이용은 access 토큰으로만 가능합니다'));
            }

            // I. 검증에 성공하면 decode 된 유저 정보를 가지고 유저가 있는지 확인
            req.user = await authService.findUserById(decoded.id);

            // I. 에러 없이 미들웨어를 통과
            next();
        } catch (err) {
            next(err);
        }
    };
};
