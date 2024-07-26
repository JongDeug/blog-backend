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
        req.user = { id: 'mockUserId' } as User;
        req.params.id = 'mockCommentId';
    });

    // --- CreateComment
    describe('createComment', () => {
        beforeEach(() => {
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

    // --- CreateCommentGuest
    describe('createCommentGuest', () => {
        beforeEach(() => {
            req.body = {
                postId: 'mockPostId',
                content: 'mockContent',
                nickName: 'mockNickname',
                email: 'mockEmail',
                password: 'mockPassword',
            };
        });

        // I. 쿠키에 아무것도 없을 때
        test('should create a guest comment successfully if req.cookies.postId is empty', async () => {
            // given
            commentsServiceMock.createCommentGuest.mockResolvedValue({
                newCommentId: 'mockCommentId',
                guestId: 'mockGuestId',
            });
            // when
            await commentsController.createCommentGuest(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newCommentId: 'mockCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(res.cookies).toHaveProperty(req.body.postId);
            expect(res.cookies[`${req.body.postId}`].value).toStrictEqual(JSON.stringify(['mockGuestId']));
        });

        // I. 쿠키에 값이 있을 때
        test('should create a guest comment successfully if req.cookies.postId is filled', async () => {
            // given
            req.cookies[`${req.body.postId}`] = JSON.stringify(['mockGuestId1']);
            commentsServiceMock.createCommentGuest.mockResolvedValue({
                newCommentId: 'mockCommentId',
                guestId: 'mockGuestId2',
            });
            // when
            await commentsController.createCommentGuest(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newCommentId: 'mockCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(res.cookies).toHaveProperty(req.body.postId);
            let parse = JSON.parse(req.cookies[`${req.body.postId}`]);
            parse.push('mockGuestId2');
            expect(res.cookies[`${req.body.postId}`].value).toStrictEqual(JSON.stringify(parse));
        });

        test('should handle error if commentsService.createCommentGuest throws error', async () => {
            // given
            commentsServiceMock.createCommentGuest.mockRejectedValue(new Error('데이터베이스: 게스트 댓글 생성 오류'));
            // when
            await commentsController.createCommentGuest(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게스트 댓글 생성 오류'));
        });
    });
    // ---

    // --- CreateChildComment
    describe('createChildComment', () => {
        beforeEach(() => {
            req.user = { id: 'mockUserId' } as User;
            req.body = {
                parentCommentId: 'mockParentCommentId',
                content: 'mockContent',
            };
        });

        test('should create a child comment successfully', async () => {
            // given
            commentsServiceMock.createChildComment.mockResolvedValue('newChildCommentId');
            // when
            await commentsController.createChildComment(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newChildCommentId: 'newChildCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(commentsServiceMock.createChildComment).toHaveBeenCalledWith(req.user.id, req.body);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await commentsController.createChildComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(commentsServiceMock.createChildComment).not.toHaveBeenCalled();
        });

        test('should handle error if commentsService.createChildComment throws error', async () => {
            // given
            commentsServiceMock.createChildComment.mockRejectedValue(new Error('데이터베이스: 대댓글 생성 오류'));
            // when
            await commentsController.createChildComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 대댓글 생성 오류'));
        });
    });
    // ---

    // --- CreateChildCommentGuest
    describe('createChildCommentGuest', () => {
        beforeEach(() => {
            req.body = {
                parentCommentId: 'mockParentCommentId',
                content: 'mockContent',
                nickName: 'mockNickname',
                email: 'mockEmail',
                password: 'mockPassword',
            };
        });

        // I. 쿠키에 아무것도 없을 때
        test('should create a guest child comment successfully req.cookies.postId is empty', async () => {
            // given
            commentsServiceMock.createChildCommentGuest.mockResolvedValue({
                newChildCommentId: 'newChildCommentId',
                guestId: 'mockGuestId',
                postId: 'mockPostId',
            });
            // when
            await commentsController.createChildCommentGuest(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newChildCommentId: 'newChildCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(res.cookies).toHaveProperty('mockPostId');
            expect(res.cookies.mockPostId.value).toStrictEqual(JSON.stringify(['mockGuestId']));
        });

        // I. 쿠키에 값이 있을 때
        test('should create a guest child comment successfully req.cookies.postId is filled', async () => {
            // given
            req.cookies.mockPostId = JSON.stringify(['mockGuestId']);
            commentsServiceMock.createChildCommentGuest.mockResolvedValue({
                newChildCommentId: 'newChildCommentId',
                guestId: 'mockGuestId2',
                postId: 'mockPostId',
            });
            // when
            await commentsController.createChildCommentGuest(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ newChildCommentId: 'newChildCommentId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(res.cookies).toHaveProperty('mockPostId');
            let parse = JSON.parse(req.cookies.mockPostId);
            parse.push('mockGuestId2');
            expect(res.cookies.mockPostId.value).toStrictEqual(JSON.stringify(parse));
        });

        test('should handle error if commentsService.createChildCommentGuest throws error', async () => {
            // given
            commentsServiceMock.createChildCommentGuest.mockRejectedValue(new Error('데이터베이스: 게스트 대댓글 생성 오류'));
            // when
            await commentsController.createChildCommentGuest(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게스트 대댓글 생성 오류'));
        });
        // ---
    });

    // --- UpdateComment
    describe('updateComment', () => {
        beforeEach(() => {
            req.body = { content: 'mockContent' };
        });

        test('should update a comment successfully', async () => {
            // when
            await commentsController.updateComment(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({});
            expect(res._isEndCalled()).toBeTruthy();
            expect(commentsServiceMock.updateComment).toHaveBeenCalledWith(req.user.id, req.params.id, req.body);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await commentsController.updateComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(commentsServiceMock.updateComment).not.toHaveBeenCalled();
        });

        test('should handle error if commentsService.updateComment throws error', async () => {
            // given
            commentsServiceMock.updateComment.mockRejectedValue(new Error('데이터베이스: 댓글 수정 오류'));
            // when
            await commentsController.updateComment(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 댓글 수정 오류'));
        });
    });
    // ---

    // --- UpdateCommentGuest
    describe('updateCommentGuest', () => {
        beforeEach(() => {
            req.body = {
                content: 'mockContent',
                password: 'mockPassword',
            };
            req.params.id = 'mockCommentId';
        });

        test('should update a guest comment successfully', async () => {
            // when
            await commentsController.updateCommentGuest(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({});
            expect(res._isEndCalled()).toBeTruthy();
            expect(commentsServiceMock.updateCommentGuest).toHaveBeenCalledWith(req.params.id, req.body);
        });

        test('should handle error if commentsService.updateCommentGuest throws error', async () => {
            // given
            commentsServiceMock.updateCommentGuest.mockRejectedValue(new Error('데이터베이스: 게스트 댓글 수정 오류'));
            // when
            await commentsController.updateCommentGuest(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게스트 댓글 수정 오류'));
        });
    });
    // ---
});
