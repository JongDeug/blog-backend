import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '@utils/customError';

interface QueryDtoType {
    search: any;
    category: any;
    page: any;
    limit: any;
    guestLikeId: any;
}

export function validateQueryDto(dtoClass: any) {
    // I. Express 미들웨어 반환
    return async (req: Request, res: Response, next: NextFunction) => {
        // I. plain -> dtoClass
        const queryDto = plainToInstance(dtoClass, req.query) as QueryDtoType;
        // I. dto 검증
        const errors = await validate(queryDto);

        if (errors.length > 0) {
            const errorMessages = errors
                .map(
                    (error) =>
                        // I. [형식] 프로퍼티 : 에러 메시지
                        `${error.property}: ${Object.values(error.constraints!).join(', ')}`
                )
                .join('\n ');

            // I. validation 실패 시 에러 넘기기
            next(new CustomError(400, 'Bad Request', errorMessages));
        }

        // I. validation 성공 (pagination, 값 변환까지)
        const limitNum = queryDto?.limit ? queryDto.limit : 10;
        const pageNum = queryDto?.page ? queryDto.page : 1;
        req.body = {
            search: queryDto?.search ? queryDto.search : '',
            category: queryDto?.category ? queryDto.category : '',
            take: limitNum,
            skip: (pageNum - 1) * limitNum,
            guestLikeId: queryDto?.guestLikeId ? queryDto.guestLikeId : '',
        };
        next();
    };
}
