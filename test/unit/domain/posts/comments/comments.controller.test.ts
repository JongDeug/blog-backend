import { NextFunction, Request, Response } from 'express';
import httpMocks from 'node-mocks-http';
import { PostsService } from '../../../../../src/domain/posts/posts.service';
import { UsersService } from '../../../../../src/domain/users/users.service';
import { CustomError } from '@utils/customError';
import { User } from '@prisma';
import { CommentsController } from '../../../../../src/domain/posts/comments/comments.controller';
import { CommentsService } from '../../../../../src/domain/posts/comments/comments.service';

jest.mock('../../../../../src/domain/posts/comments/comments.service');
jest.mock('../../../../../src/domain/posts/posts.service');
jest.mock('../../../../../src/domain/users/users.service');

describe('CommentsController', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;
    let commentsServiceMock: jest.Mocked<CommentsService>;
    let commentsController: CommentsController;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
        commentsServiceMock = jest.mocked(new CommentsService(new UsersService(), new PostsService(new UsersService()))) as jest.Mocked<CommentsService>;
        commentsController = new CommentsController(commentsServiceMock);
    });

    // --- CreateComment
    describe('createComment', () => {
        beforeEach(() => {
            req.user = { id: 'mockUserId' } as User;
            req.body = {
                postId: 'mockPostId',
                content: 'mockContent',
            };
        });

        test('should create a comment successfully', async () => {
            // given
            commentsServiceMock.createComment.mockResolvedValue('newCommentId');
            // when
            await commentsController.createComment(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newCommentId: 'newCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(commentsServiceMock.createComment).toHaveBeenCalledWith(req.user.id, req.body);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await commentsController.createComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(commentsServiceMock.createComment).not.toHaveBeenCalled();
        });

        test('should handle error if commentsService.createComment throws error', async () => {
            // given
            commentsServiceMock.createComment.mockRejectedValue(new Error('데이터베이스: 댓글 생성 오류'));
            // when
            await commentsController.createComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 댓글 생성 오류'));
        });
    });
    // ---
});
