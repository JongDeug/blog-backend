import { PostsService } from '../../../../src/domain/posts/posts.service';
import { prismaMock } from '../../../singleton';
import { CreatePostDto, UpdatePostDto } from '../../../../src/domain/posts/dto';
import { Image, Post, Prisma, User } from '@prisma';
import { CustomError } from '@utils/customError';
import { deleteImage } from '@utils/filesystem';
import { PaginationType } from '@custom-type/customPagination';
import { UsersService } from '../../../../src/domain/users/users.service';

jest.mock('../../../../src/domain/users/users.service');
jest.mock('@utils/filesystem'); // 정확한 명칭으로 설정하니 에러가 사라짐.

describe('PostsService Main Functions', () => {
    let postsService: PostsService;
    let usersServiceMock: jest.Mocked<UsersService>;

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsService = new PostsService(usersServiceMock);
        postsService.findPostById = jest.fn();
    });

    // --- CreatePost
    describe('createPost', () => {
        const mockUserId = 'mockUserId';
        const mockDto: CreatePostDto = {
            title: 'Test Title',
            content: 'Test Content',
            category: 'TestCategory',
            images: [{ path: 'images' }, { path: 'images' }],
            tags: ['Tag1', 'Tag2'],
        };

        test('should create a post successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            // 아직 이해가 필요해!!!
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            prismaMock.post.create.mockResolvedValue({ id: 'newPostId' } as Post);

            // when
            const result = await postsService.createPost(mockUserId, mockDto);
            // then
            expect(result).toBe('newPostId');
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.create).toHaveBeenCalledWith({
                data: {
                    title: mockDto.title,
                    content: mockDto.content,
                    category: {
                        connectOrCreate: {
                            where: { name: mockDto.category },
                            create: { name: mockDto.category },
                        },
                    },
                    author: {
                        connect: { id: mockUserId },
                    },
                    images: {
                        createMany: {
                            data: mockDto.images.map(image => ({ url: image.path })),
                        },
                    },
                },
            });
            expect(prismaMock.postTag.create).toHaveBeenCalledTimes(mockDto.tags!.length);
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.createPost(mockUserId, mockDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(prismaMock.$transaction).not.toHaveBeenCalled(); // not
        });

        test('should rollback transaction on failure', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    await callback(prismaMock);
                } catch (error) {
                    throw error;
                }
            });
            prismaMock.post.create.mockRejectedValue(new Error('데이터베이스: 게시글 생성 오류'));

            // when, then
            await expect(postsService.createPost(mockUserId, mockDto)).rejects.toEqual(new Error('데이터베이스: 게시글 생성 오류'));

            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.create).toHaveBeenCalled();
        });
    });
    // ---

    // --- UpdatePost
    describe('update', () => {
        const mockUserId = 'mockUserId';
        const mockPostId = 'mockPostId';
        type PostIncludingImageType = Post & { images: Pick<Image, 'url'>[] }
        const mockPost = {
            id: 'mockPostId',
            authorId: 'mockUserId',
            images: [{ url: 'images' }, { url: 'images' }],
        };
        const mockDto: UpdatePostDto = {
            title: 'Test Title',
            content: 'Test Content',
            category: 'TestCategory',
            images: [{ path: 'images' }, { path: 'images' }],
            tags: ['Tag1', 'Tag2'],
        };

        test('should update a post successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            (deleteImage as jest.Mock).mockResolvedValue(['파일 삭제 성공1', '파일 삭제 성공2']);
            // when
            await postsService.updatePost(mockUserId, mockPostId, mockDto);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(postsService.findPostById).toHaveBeenCalledWith(mockPostId, { images: true });
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.image.deleteMany).toHaveBeenCalledWith({
                where: { postId: mockPost.id },
            });
            expect(prismaMock.postTag.deleteMany).toHaveBeenCalledWith({
                where: { postId: mockPost.id },
            });
            expect(prismaMock.postTag.create).toHaveBeenCalledTimes([...new Set(mockDto.tags)].length);
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalledWith({
                where: {
                    posts: {
                        none: {},
                    },
                },
            });
            expect(deleteImage).toHaveBeenCalledWith(mockPost.images);
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).not.toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should throw error if user does not have permission', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            mockPost.authorId = 'wrongUser'; // 틀린 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should rollback transaction on failure', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            mockPost.authorId = 'mockUserId'; // 다시 맞는 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    await callback(prismaMock);
                } catch (error) {
                    throw error;
                }
            });
            prismaMock.post.update.mockRejectedValue(new Error('데이터베이스: 게시글 업데이트 오류'));
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toEqual(
                new Error('데이터베이스: 게시글 업데이트 오류'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).not.toHaveBeenCalled();
        });

        test('should throw error if images fail to delete', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            (deleteImage as jest.Mock).mockRejectedValue(new Error('에러: 파일을 삭제하지 못했습니다'));
            // when
            await postsService.updatePost(mockUserId, mockPostId, mockDto);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalled();
            expect(deleteImage).toHaveBeenCalled();
        });
    });
    // ---

    // --- DeletePost
    describe('deletePost', () => {
        const mockUserId = 'mockUserId';
        const mockPostId = 'mockPostId';
        type PostIncludingImageType = Post & { images: Pick<Image, 'url'>[] }
        const mockPost = {
            id: 'mockPostId',
            authorId: 'mockUserId',
            images: [{ url: 'images' }, { url: 'images' }],
        };

        test('should delete a post successfully', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            (deleteImage as jest.Mock).mockResolvedValue(['파일 삭제 성공1', '파일 삭제 성공2']);
            // when
            await postsService.deletePost(mockUserId, mockPostId);
            // then
            expect(postsService.findPostById).toHaveBeenCalledWith(mockPostId, { images: true });
            expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id: mockPost.id } });
            expect(prismaMock.tag.deleteMany).toHaveBeenCalledWith({ where: { posts: { none: {} } } });
            expect(deleteImage).toHaveBeenCalledWith(mockPost.images);
        });

        test('should throw error if post is not found', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.deletePost(mockUserId, mockPostId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if user dose not have permission', async () => {
            // given
            mockPost.authorId = 'wrongUser'; // 틀린 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            // when, then
            await expect(postsService.deletePost(mockUserId, mockPostId)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if images fail to delete', async () => {
            // given
            mockPost.authorId = 'mockUserId'; // 다시 맞는 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockPost as PostIncludingImageType);
            (deleteImage as jest.Mock).mockRejectedValue(new Error('에러: 파일을 삭제하지 못했습니다'));
            // when
            await postsService.deletePost(mockUserId, mockPostId);
            // then
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalled();
            expect(deleteImage).toHaveBeenCalled();
        });
    });
    // ---

    // --- GetPosts
    describe('getPosts', () => {
        const mockPagination: PaginationType = {
            skip: 10,
            take: 10,
        };
        const mockSearchQuery = 'mockSearchQuery';
        const mockCategory = 'mockCategory';
        const mockReturnedPosts = [
            { id: 'mockId1' } as Post,
            { id: 'mockId2' } as Post,
        ];

        test('should get posts successfully', async () => {
            // given
            prismaMock.post.findMany.mockResolvedValue(mockReturnedPosts);
            // when
            const result = await postsService.getPosts(mockPagination, mockSearchQuery, mockCategory);
            // then
            expect(result.posts).toStrictEqual(mockReturnedPosts);
            expect(result.postCount).toBe(mockReturnedPosts.length);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: mockSearchQuery } },
                        { content: { contains: mockSearchQuery } },
                    ],
                    category: { name: mockCategory },
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc', // 내림, 최신순
                },
                skip: mockPagination.skip,
                take: mockPagination.take,
            });
        });

        test('should get posts successfully even if searchQuery is undefined', async () => {
            // given
            prismaMock.post.findMany.mockResolvedValue(mockReturnedPosts);
            // when
            const result = await postsService.getPosts(mockPagination, undefined, mockCategory);
            // then
            expect(result.posts).toStrictEqual(mockReturnedPosts);
            expect(result.postCount).toBe(mockReturnedPosts.length);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: '' } }, // 만약 undefined 이라면
                        { content: { contains: '' } }, // 만약 undefined 이라면
                    ],
                    category: { name: mockCategory },
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc', // 내림, 최신순
                },
                skip: mockPagination.skip,
                take: mockPagination.take,
            });
        });

        test('should get posts successfully even if category is undefined', async () => {
            // given
            prismaMock.post.findMany.mockResolvedValue(mockReturnedPosts);
            // when
            const result = await postsService.getPosts(mockPagination, mockSearchQuery, undefined);
            // then
            expect(result.posts).toStrictEqual(mockReturnedPosts);
            expect(result.postCount).toBe(mockReturnedPosts.length);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: mockSearchQuery } },
                        { content: { contains: mockSearchQuery } },
                    ],
                    category: {}, // 만약 undefined 이라면
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc', // 내림, 최신순
                },
                skip: mockPagination.skip,
                take: mockPagination.take,
            });
        });
    });
    // ---

    // --- GetPost
    describe('getPost', () => {
        const mockPostId = 'mockPostId';
        const mockGuestUserId = 'mockGuestUserId';
        // type getPostType = Prisma.PromiseReturnType<typeof postsService.findPostById>
        const mockReturnedPost = {
            id: 'mockPostId',
            postLikes: [{ postId: mockPostId, guestUserId: mockGuestUserId }],
        };

        test('should get post successfully', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockReturnedPost);
            // when
            const result = await postsService.getPost(mockPostId, mockGuestUserId);
            // then
            expect(result).toStrictEqual({ post: { ...mockReturnedPost, isLiked: true } });
            expect(postsService.findPostById).toHaveBeenCalledWith(mockPostId, {
                tags: true,
                _count: {
                    select: { postLikes: true },
                },
                postLikes: true,
                images: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
                author: {
                    select: {
                        name: true,
                    },
                },
                comments: true, // R. comment 작성 후 고치기
            });
        });

        test('should throw error if post is not found', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.getPost(mockPostId, mockGuestUserId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
        });
    });
    //

    // --- PostLike
    describe('postLike', () => {
        const mockGuestUserId = 'mockGuestUserId';
        const mockDto = { postId: 'mockPostId', tryToLike: true };
        const mockReturnedPost = { id: mockDto.postId };
        const mockReturnedLiked = { postId: mockDto.postId, guestUserId: mockGuestUserId };

        // I. 좋아요 생성
        test('should create a postLike if tryToLike is true and postLike does not exist', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockReturnedPost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.postLike(mockGuestUserId, mockDto)).resolves.toBeUndefined();
            expect(postsService.findPostById as jest.Mock).toHaveBeenCalledWith(mockDto.postId);
            expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
                where: {
                    postId_guestUserId: {
                        postId: mockReturnedPost.id,
                        guestUserId: mockGuestUserId,
                    },
                },
            });
            expect(prismaMock.postLike.create).toHaveBeenCalledWith({
                data: {
                    post: { connect: { id: mockReturnedPost.id } },
                    guestUser: { connect: { id: mockGuestUserId } },
                },
            });
            expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
        });

        // I. 좋아요 삭제
        test('should delete a postLike if tryToLike is false and postLike exits', async () => {
            // given
            mockDto.tryToLike = false;
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockReturnedPost);
            prismaMock.postLike.findUnique.mockResolvedValue({ postId: 'mockPostId', guestUserId: mockGuestUserId });
            // when, then
            await expect(postsService.postLike(mockGuestUserId, mockDto)).resolves.toBeUndefined();
            expect(prismaMock.postLike.delete).toHaveBeenCalledWith({
                where: {
                    postId_guestUserId: {
                        postId: mockReturnedPost.id,
                        guestUserId: mockGuestUserId,
                    },
                },
            });
            // expect(prismaMock.guestUser.deleteMany).toHaveBeenCalledWith({
            //     where: {
            //         postLikes: { none: {} },
            //         comments: { none: {} },
            //     },
            // });
            expect(prismaMock.postLike.create).not.toHaveBeenCalled();
        });

        test('should throw error if client sends an invalid request', async () => {
            // given
            mockDto.tryToLike = false;
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockReturnedPost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.postLike(mockGuestUserId, mockDto)).rejects.toThrow(
                new CustomError(400, 'Bad Request', '잘못된 요청입니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
            expect(prismaMock.postLike.create).not.toHaveBeenCalled();
            expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.postLike(mockGuestUserId, mockDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.postLike.findUnique).not.toHaveBeenCalled();
        });
    });
    // ---
});

describe('PostsService Util Functions', () => {
    let postsService: PostsService;
    let usersServiceMock: jest.Mocked<UsersService>;

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsService = new PostsService(usersServiceMock);
    });

    // --- FindPostById
    describe('findPostById', () => {
        const mockPostId = 'mockPostId';
        type GetPostType = Prisma.PromiseReturnType<typeof prismaMock.post.findUnique>
        type PostWithImages = GetPostType & { images: [] }
        const mockReturnedPost = { id: 'mockPostId' };
        const mockReturnedPostWithImages = { id: 'mockPostId', images: [] };

        test('should get a post successfully without includeOptions', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockReturnedPost as GetPostType);
            // when
            const result = await postsService.findPostById(mockPostId);
            // then
            expect(result).toStrictEqual(mockReturnedPost);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockPostId },
                include: {},
            });
        });

        test('should get a post successfully with includeOptions', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockReturnedPostWithImages as PostWithImages);
            // when
            const result = await postsService.findPostById(mockPostId, { images: true });
            // then
            expect(result).toStrictEqual(mockReturnedPostWithImages);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockPostId },
                include: { images: true },
            });
        });

        test('should throw error if post is not found', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.findPostById(mockPostId, { images: true })).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
        });
    });
    // ---
});
