import { RequestHandler } from 'express';
import { CustomError } from '@utils/customError';

export const verifyRoles = (...allowedRoles: number[]): RequestHandler => {
    return async (req, res, next) => {
        try {
            // I. req.user?.role 에 값이 없으면 에러
            if (!req.user?.role) {
                return next(
                    new CustomError(
                        500,
                        'Internal Server Error',
                        '유저의 role 값이 없습니다'
                    )
                );
            }

            // I. 허용된 roles 를 req.user.role 이 가지고 있지 않으면 에러
            if (!allowedRoles.includes(req.user.role)) {
                return next(
                    new CustomError(
                        403,
                        'Unauthorized',
                        '해당 API 를 사용할 권한이 없습니다'
                    )
                );
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};
