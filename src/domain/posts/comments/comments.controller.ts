import { NextFunction, Request, Response } from 'express';
import { CommentsService } from './comments.service';
import { CustomError } from '@utils/customError';

export class CommentsController {
    constructor(private readonly commentsService: CommentsService) {
    }

    createComment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            // I. commentsService.createComment 호출
            const newCommentId = await this.commentsService.createComment(
                req.user.id,
                req.body,
            );

            res.status(201).json({ newCommentId });
        } catch (err) {
            next(err);
        }
    };

    createCommentGuest = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            // I. JWT 인증 x

            // I. commentsService.createCommentGuest 호출
            const { newCommentId, guestCommentId } =
                await this.commentsService.createCommentGuest(req.body);

            res.status(201).json({ newCommentId, guestCommentId });
        } catch (err) {
            next(err);
        }
    };

    createChildComment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            // I. commentsService.createChildComment 호출
            const newChildCommentId =
                await this.commentsService.createChildComment(
                    req.user.id,
                    req.body,
                );

            res.status(201).json({ newChildCommentId });
        } catch (err) {
            next(err);
        }
    };

    createChildCommentGuest = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            // I. JWT 인증 x

            // I. commentsService.createChildCommentGuest 호출
            const { newChildCommentId, guestCommentId, postId } =
                await this.commentsService.createChildCommentGuest(req.body);

            res.status(201).json({ newChildCommentId, guestCommentId, postId });
        } catch (err) {
            next(err);
        }
    };

    // ----

    updateComment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            const { id } = req.params;
            // I. commentsService.updateComment 호출
            await this.commentsService.updateComment(req.user.id, id, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    updateCommentGuest = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            // I. JWT 인증 x

            const { id } = req.params;
            // I. commentsService.updateCommentGuest 호출
            await this.commentsService.updateCommentGuest(id, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    // ---
    deleteComment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            const { id } = req.params;
            // I. commentsService.deleteComment 호출
            await this.commentsService.deleteComment(req.user, id);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    deleteCommentGuest = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            // I. JWT 인증 x

            const { id } = req.params;
            // I. commentsService.deleteCommentGuest 호출
            const { guestCommentId, postId } =
                await this.commentsService.deleteCommentGuest(id, req.body);

            res.status(200).json({ guestCommentId, postId });
        } catch (err) {
            next(err);
        }
    };
}
