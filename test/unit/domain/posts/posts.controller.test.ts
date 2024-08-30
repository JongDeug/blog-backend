import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { PostsController } from '../../../../src/domain/posts/posts.controller';
import { PostsService } from '../../../../src/domain/posts/posts.service';
import { Prisma, User } from '../../../../prisma/prisma-client';
import { CustomError } from '@utils/customError';
import { UsersService } from '../../../../src/domain/users/users.service';
import process from 'node:process';

jest.mock('../../../../src/domain/auth/auth.service');
jest.mock('../../../../src/domain/users/users.service');
jest.mock('../../../../src/domain/posts/posts.service');

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
        postsServiceMock = jest.mocked(new PostsService(new UsersService())) as jest.Mocked<PostsService>;
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
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ id: 'newPostId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.createPost).toHaveBeenCalledWith(req.user.id, req.body);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await postsController.createPost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(postsServiceMock.createPost).not.toHaveBeenCalled();
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

    // --- UpdatePost
    describe('updatePost', () => {
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
            req.params.id = 'mockPostId';
        });

        test('should update a post successfully', async () => {
            // when
            await postsController.updatePost(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({});
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.updatePost).toHaveBeenCalledWith(req.user.id, req.params.id, req.body);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await postsController.updatePost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(postsServiceMock.updatePost).not.toHaveBeenCalled();
        });

        test('should handle error if postsService.updatePost throws error', async () => {
            // given
            postsServiceMock.updatePost.mockRejectedValue(new Error('데이터베이스: 게시글 수정 오류'));
            // when
            await postsController.updatePost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 수정 오류'));
        });
    });
    // ---

    // --- DeletePost
    describe('deletePost', () => {
        beforeEach(() => {
            req.user = { id: 'mockUserId' } as User;
            req.params.id = 'mockPostId';
        });

        test('should delete a post successfully', async () => {
            // when
            await postsController.deletePost(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({});
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.deletePost).toHaveBeenCalledWith(req.user.id, req.params.id);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await postsController.deletePost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(postsServiceMock.deletePost).not.toHaveBeenCalled();
        });

        test('should handle error if postsService.deletePost throws error', async () => {
            // given
            postsServiceMock.deletePost.mockRejectedValue(new Error('데이터베이스: 게시글 삭제 오류'));
            // when
            await postsController.deletePost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 삭제 오류'));
        });
    });
    // ---

    // --- GetPosts
    describe('getPosts', () => {
        type getPostsType = Prisma.PromiseReturnType<typeof postsServiceMock.getPosts>
        const mockReturnedPosts = { posts: [{ id: 'mockPostId' }, { id: 'mockPostId' }], postCount: 10 };

        beforeEach(() => {
            req.query = {
                search: '',
                category: '',
                page: '3',
                limit: '10',
            };
            req.body = {
                search: '',
                category: '',
                skip: 3,
                take: 10,
            };
        });

        test('should get posts successfully', async () => {
            // given
            postsServiceMock.getPosts.mockResolvedValue(mockReturnedPosts as getPostsType);
            // when
            await postsController.getPosts(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual(mockReturnedPosts);
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.getPosts).toHaveBeenCalledWith(req.body.take, req.body.skip, req.body.search, req.body.category);
        });

        test('should handle error if postsService.getPosts throws error', async () => {
            // given
            postsServiceMock.getPosts.mockRejectedValue(new Error('데이터베이스: 게시글 목록 조회 오류'));
            // when
            await postsController.getPosts(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 목록 조회 오류'));
        });
    });
    // ---

    // --- GetPost
    describe('getPost', () => {
        type GetPostType = Prisma.PromiseReturnType<typeof postsServiceMock.getPost>
        const mockReturnedPost = { post: { id: 'mockPostId', isLiked: true } };

        beforeEach(() => {
            req.params.id = 'mockPostId';
            req.body.guestLikeId = 'mockGuestLikeId';
        });

        test('should get a post successfully', async () => {
            // given
            postsServiceMock.getPost.mockResolvedValue(mockReturnedPost as GetPostType);
            // when
            await postsController.getPost(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual(mockReturnedPost);
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.getPost).toHaveBeenCalledWith(req.params.id, req.body.guestLikeId);
        });

        test('should handle error if postsService.getPost throws error', async () => {
            // given
            postsServiceMock.getPost.mockRejectedValue(new Error('데이터베이스: 게시글 상세 조회 오류'));
            // when
            await postsController.getPost(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 상세 조회 오류'));
        });
    });
    // ---

    // --- PostLike
    describe('postLike', () => {
        beforeEach(() => {
            req.cookies.guestUserId = 'mockGuestUserId';
            req.body = {
                postId: 'mockPostId',
                tryToLike: true,
                guestLikeId: '',
            };
        });

        test('should create a postLike or delete a postLike successfully', async () => {
            // given
            postsServiceMock.postLike.mockResolvedValue('mockGuestLikeId');
            // when
            await postsController.postLike(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ guestLikeId: 'mockGuestLikeId' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.postLike).toHaveBeenCalledWith(req.body);
        });

        test('should handle error if postsService.postLike throw errors', async () => {
            // given
            postsServiceMock.postLike.mockRejectedValue(new Error('데이터베이스: 게시글 좋아요 오류'));
            // when
            await postsController.postLike(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('데이터베이스: 게시글 좋아요 오류'));
        });
    });
    // ---

    // --- UploadImage
    describe('uploadImage', () => {
        beforeEach(() => {
            req.user = { id: 'mockUserId' } as User;
            req.file = { path: 'mock/url.jpg' } as Express.Multer.File;
        });

        test('should upload a image successfully', async () => {
            postsServiceMock.uploadImage.mockResolvedValue('mock/url.jpg');
            // when
            await postsController.uploadImage(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({
                success: 1,
                file: { url: `${process.env.ORIGIN}/${req?.file?.path}` },
            });
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.uploadImage).toHaveBeenCalledWith(req.file);
        });

        test('should handle error if user is not authenticated', async () => {
            // given
            req.user = undefined;
            // when
            await postsController.uploadImage(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            expect(postsServiceMock.uploadImage).not.toHaveBeenCalled();
        });

        test('should handle error if postsService.uploadImage throws error', async () => {
            // given
            postsServiceMock.uploadImage.mockRejectedValue(new Error('이미지 업로드 오류'));
            // when
            await postsController.uploadImage(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('이미지 업로드 오류'));
        });

    });
    // ---
});
