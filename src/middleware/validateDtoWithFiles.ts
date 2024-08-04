import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '@utils/customError';
import { CreatePostDto } from '../domain/posts/dto';

export function validateDtoWithFiles(dtoClass: any) {
    // I. Express 미들웨어 반환
    return async (req: Request, res: Response, next: NextFunction) => {
        // I. req.body 변환 (이미지 파일, 태그)
        req.body.images = CreatePostDto.parseFiles(req.files as Express.Multer.File[]);
        req.body.tags = CreatePostDto.parseTags(req.body.tags);

        // I. plain -> dtoClass
        const dto: any = plainToInstance(dtoClass, req.body);

        // I. dto 검증
        const errors = await validate(dto);

        if (errors.length > 0) {
            const errorMessages = errors
                .map(
                    (error) =>
                        // I. 앞글자 대문자 : 에러 메시지
                        `${error.property}: ${Object.values(error.constraints!).join(', ')}`,
                )
                .join('\n ');
            // I. validation 실패 시 에러 넘기기
            next(new CustomError(400, 'Bad Request', errorMessages));
        }

        // I. validation 성공
        next();
    };
}
