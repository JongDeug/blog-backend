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

    createCommentGuest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 x

            // I. commentsService.createCommentGuest 호출
            const { newCommentId, guestId } = await this.commentsService.createCommentGuest(req.body);

            // I. 쿠키에 배열로 저장
            const postId = req.cookies[`${req.body.postId}`];
            if (postId) {
                let parse = JSON.parse(postId);
                parse.push(guestId);
                res.cookie(`${req.body.postId}`, JSON.stringify(parse), {});
            } else {
                res.cookie(`${req.body.postId}`, JSON.stringify([guestId]), {});
            }

            res.status(201).json({ newCommentId });
        } catch (err) {
            next(err);
        }
    };

    createChildComment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. commentsService.createChildComment 호출
            const newChildCommentId = await this.commentsService.createChildComment(req.user.id, req.body);

            res.status(201).json({ newChildCommentId });
        } catch (err) {
            next(err);
        }
    };

    createChildCommentGuest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 x

            // I. commentsService.createChildCommentGuest 호출
            const { newChildCommentId, guestId, postId } = await this.commentsService.createChildCommentGuest(req.body);

            // I. 쿠키에 배열로 저장
            const cookiePostId = req.cookies[`${postId}`];
            if (cookiePostId) {
                let parse = JSON.parse(cookiePostId);
                parse.push(guestId);
                res.cookie(postId, JSON.stringify(parse), {});
            } else {
                res.cookie(postId, JSON.stringify([guestId]), {});
            }

            res.status(201).json({ newChildCommentId });
        } catch (err) {
            next(err);
        }
    };
}
