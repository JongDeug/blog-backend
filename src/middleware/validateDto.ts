import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Request, Response, NextFunction } from 'express';

export function validateDto(dtoClass: any) {
    // I. Express 미들웨어 반환
    return async (req: Request, res: Response, next: NextFunction) => {
        // I. plain -> dtoclass
        const dto = plainToInstance(dtoClass, req.body);
        // I. dto 검증
        const errors = await validate(dto);

        if (errors.length > 0) {
            const errorMessages = errors.map(error =>
                // I. 앞글자 대문자 : 에러 메시지
                `${error.property}: ${Object.values(error.constraints!).join(', ')}`,
            ).join('\n ');

            // I. validation 실패 시 에러 넘기기
            next({ status: 400, message: errorMessages });
        }

        // I. validation 성공
        next();
    };
}
