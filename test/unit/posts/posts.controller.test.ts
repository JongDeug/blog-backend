import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { PostsController } from '../../../src/domain/posts/posts.controller';
import { PostsService } from '../../../src/domain/posts/posts.service';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { User } from '@prisma';
import { CustomError } from '@utils';

jest.mock('../../../src/domain/auth/auth.service');
jest.mock('../../../src/domain/posts/posts.service');

describe('PostsController', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;
    let postsController: PostsController;
    let postsServiceMock: jest.Mocked<PostsService>;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
        postsServiceMock = jest.mocked(new PostsService(new AuthService())) as jest.Mocked<PostsService>;
        postsController = new PostsController(postsServiceMock);
    });

    // --- CreatePost
    describe('createPost', () => {
        beforeEach(() => {
            req.user = { id: 'mockUserId' } as User;
            req.body = {
                title: 'Test Title',
                content: 'Test Content',
                category: 'TestCategory',
                tags: ['Tag1', 'Tag2'],
            };
            req.files = [
                { path: 'image1.jpg' } as Express.Multer.File,
                { path: 'image2.jpg' } as Express.Multer.File,
            ];
        });

        test('should create a post successfully', async () => {
            // given
            postsServiceMock.createPost.mockResolvedValue('newPostId');
            // when
            await postsController.createPost(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ id: 'newPostId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.createPost).toHaveBeenCalledWith(req.user.id, {
                title: 'Test Title',
                content: 'Test Content',
                category: 'TestCategory',
                tags: ['Tag1', 'Tag2'],
                images: [{ path: 'image1.jpg' }, { path: 'image2.jpg' }],
            });
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await postsController.createPost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
        });

        test('should handle error if validation dto fails', async () => {
            // given
            req.body = {
                title: 12,
                content: 'Test Content',
                category: 'TestCategory',
                tags: ['Tag1', 'Tag2'],
            };
            // when
            await postsController.createPost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(expect.any(CustomError));
            expect(next).toHaveBeenCalledWith(new CustomError(400, 'Bad Request', 'title: title must be a string'));
        });

        test('should handle error if postsService.createPost throws error', async () => {
            // given
            postsServiceMock.createPost.mockRejectedValue(new Error('데이터베이스: 게시글 생성 오류'));
            // when
            await postsController.createPost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 생성 오류'));
        });
    });
    // ---
});
