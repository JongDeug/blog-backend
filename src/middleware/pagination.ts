import { NextFunction, Request, Response } from 'express';
import { PaginationType } from '@custom-type/customPagination';
import { CustomError } from '@utils/customError';

export function pagination(req: Request, res: Response, next: NextFunction) {
    // I. page, limit 받고 변환
    let { page, limit } = req.query;

    // I. 배열로 들어오면 에러 반환
    if (typeof page === 'object')
        return next(
            new CustomError(400, 'Bad Request', 'page: 잘못된 형식입니다')
        );
    if (typeof limit === 'object')
        return next(
            new CustomError(400, 'Bad Request', 'limit: 잘못된 형식입니다')
        );

    if (page === '') page = undefined;
    if (limit === '') limit = undefined;

    let pageNumber = page ? Number(page) : 1;
    let limitNumber = limit ? Number(limit) : 10;

    // I. skip, take 만들기
    const take = limitNumber;
    const skip = (pageNumber - 1) * take; // 1페이지부터

    // I. request 에 넣기
    req.pagination = { skip, take };

    // I. 다음
    next();
}
