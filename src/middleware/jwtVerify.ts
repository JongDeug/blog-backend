import { RequestHandler } from 'express';
import { database } from '@utils';
import { CustomJwtPayload } from '@custom-type/customJwtPayload';
import jwt, { Secret } from 'jsonwebtoken';

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
        let decoded: CustomJwtPayload;
        try {
            decoded = <CustomJwtPayload>jwt.verify(accessToken, process.env.JWT_SECRET as Secret);
        } catch (e) {
            return next({ status: 401, message: '토큰이 만료됐거나 잘못된 토큰입니다' });
        }

        // I. 만약 토큰 타입이 access 아니라면
        if (decoded.type !== 'access') {
            return next({ status: 401, message: '서비스 이용은 access 토큰으로만 가능합니다' });
        }

        // I. 검증에 성공하면 decode 된 유저 정보를 가지고 유저가 있는지 확인
        const user = await database.user.findUnique({ where: { id: decoded!.id } });

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
