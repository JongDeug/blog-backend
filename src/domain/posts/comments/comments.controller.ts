import { NextFunction, Request, Response } from 'express';
import { CommentsService } from './comments.service';
import { CustomError } from '@utils/customError';

export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {
    }

    createComment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. commentsService.createComment 호출

            const newCommentId = await this.commentsService.createComment(req.user.id, req.body);

            res.status(201).json({ newCommentId });
        } catch (err) {
            next(err);
        }
    };
}
