import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { PostsController } from '../../../../src/domain/posts/posts.controller';
import { PostsService } from '../../../../src/domain/posts/posts.service';
import { Prisma, User } from '@prisma';
import { CustomError } from '@utils/customError';
import { UsersService } from '../../../../src/domain/users/users.service';

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
            req.pagination = {
                skip: 10,
                take: 10,
            };
            req.query.searchQuery = '';
            req.query.category = '';
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
            expect(postsServiceMock.getPosts).toHaveBeenCalledWith(req.pagination, req.query.searchQuery, req.query.category);
        });

        test('should handle error if searchQuery type is object', async () => {
            // given
            req.query.searchQuery = ['mock', 'mock'];
            // when
            await postsController.getPosts(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(400, 'Bad Request', 'searchQuery: 잘못된 형식입니다'));
            expect(postsServiceMock.getPosts).not.toHaveBeenCalled();
        });

        test('should handle error if category type is object', async () => {
            // given
            req.query.category = ['mock', 'mock'];
            // when
            await postsController.getPosts(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(400, 'Bad Request', 'category: 잘못된 형식입니다'));
            expect(postsServiceMock.getPosts).not.toHaveBeenCalled();
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
        type PostWithIsLiked = GetPostType & { isLiked: boolean }
        const mockReturnedPost = { post: { id: 'mockPostId', isLiked: true } };

        beforeEach(() => {
            req.params.id = 'mockPostId';
            req.cookies.postLikeGuestId = 'mockGuestUserId';
        });

        test('should get a post successfully', async () => {
            // given
            postsServiceMock.getPost.mockResolvedValue(mockReturnedPost as PostWithIsLiked);
            // when
            await postsController.getPost(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual(mockReturnedPost);
            expect(res._isEndCalled()).toBeTruthy();
            expect(postsServiceMock.getPost).toHaveBeenCalledWith(req.params.id, req.cookies.postLikeGuestId);
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
                postLikeGuestId: '',
            };
        });

        test('should create a postLike or delete a postLike successfully', async () => {
            // given
            postsServiceMock.postLike.mockResolvedValue('mockPostLikeGuestId');
            // when
            await postsController.postLike(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ postLikeGuestId: 'mockPostLikeGuestId' });
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
});
