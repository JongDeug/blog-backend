import { PostsService } from '../../../../src/domain/posts/posts.service';
import { AuthService } from '../../../../src/domain/auth/auth.service';
import { prismaMock } from '../../../singleton';
import { CreatePostDto, UpdatePostDto } from '../../../../src/domain/posts/dto';
import { Image, Post, Prisma, User } from '@prisma';
import { CustomError } from '@utils/customError';
import { deleteImage } from '@utils/filesystem';
import { PaginationType } from '@custom-type/customPagination';

jest.mock('../../../../src/domain/auth/auth.service');
jest.mock('@utils/filesystem'); // 정확한 명칭으로 설정하니 에러가 사라짐.

describe('PostsService', () => {
    let postsService: PostsService;
    let authServiceMock: jest.Mocked<AuthService>;

    beforeEach(() => {
        authServiceMock = jest.mocked(new AuthService()) as jest.Mocked<AuthService>;
        postsService = new PostsService(authServiceMock);
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
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            // 아직 이해가 필요해!!!
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            prismaMock.post.create.mockResolvedValue({ id: 'newPostId' } as Post);

            // when
            const result = await postsService.createPost(mockUserId, mockDto);
            // then
            expect(result).toBe('newPostId');
            expect(authServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
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
            authServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.createPost(mockUserId, mockDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(authServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(prismaMock.$transaction).not.toHaveBeenCalled(); // not
        });

        test('should rollback transaction on failure', async () => {
            // given
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
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
            expect(authServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
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
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            (deleteImage as jest.Mock).mockResolvedValue(['파일 삭제 성공1', '파일 삭제 성공2']);
            // when
            await postsService.updatePost(mockUserId, mockPostId, mockDto);
            // then
            expect(authServiceMock.findUserById).toHaveBeenCalledWith(mockUserId);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockPostId },
                include: {
                    images: true,
                },
            });
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
            authServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(authServiceMock.findUserById).toHaveBeenCalled();
            expect(prismaMock.post.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(authServiceMock.findUserById).toHaveBeenCalled();
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should throw error if user does not have permission', async () => {
            // given
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            mockPost.authorId = 'wrongUser'; // 틀린 아이디 주입
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            // when, then
            await expect(postsService.updatePost(mockUserId, mockPostId, mockDto)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(authServiceMock.findUserById).toHaveBeenCalled();
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should rollback transaction on failure', async () => {
            // given
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            mockPost.authorId = 'mockUserId'; // 다시 맞는 아이디 주입
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
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
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).not.toHaveBeenCalled();
            expect(deleteImage).not.toHaveBeenCalled();
        });

        test('should throw error if images fail to delete', async () => {
            // given
            authServiceMock.findUserById.mockResolvedValue({ id: mockUserId } as User);
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            (deleteImage as jest.Mock).mockRejectedValue(new Error('에러: 파일을 삭제하지 못했습니다'));
            // when, then
            await postsService.updatePost(mockUserId, mockPostId, mockDto);
            expect(authServiceMock.findUserById).toHaveBeenCalled();
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
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
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            (deleteImage as jest.Mock).mockResolvedValue(['파일 삭제 성공1', '파일 삭제 성공2']);
            // when
            await postsService.deletePost(mockUserId, mockPostId);
            // then
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockPostId },
                include: { images: true },
            });
            expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id: mockPost.id } });
            expect(prismaMock.tag.deleteMany).toHaveBeenCalledWith({ where: { posts: { none: {} } } });
            expect(deleteImage).toHaveBeenCalledWith(mockPost.images);
        });

        test('should throw error if post is not found', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.deletePost(mockUserId, mockPostId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if user dose not have permission', async () => {
            // given
            mockPost.authorId = 'wrongUser'; // 틀린 아이디 주입
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            // when, then
            await expect(postsService.deletePost(mockUserId, mockPostId)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if images fail to delete', async () => {
            // given
            mockPost.authorId = 'mockUserId'; // 다시 맞는 아이디 주입
            prismaMock.post.findUnique.mockResolvedValue(mockPost as PostIncludingImageType);
            (deleteImage as jest.Mock).mockRejectedValue(new Error('에러: 파일을 삭제하지 못했습니다'));
            // when
            await postsService.deletePost(mockUserId, mockPostId);
            // then
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
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
        type getPostType = Prisma.PromiseReturnType<typeof prismaMock.post.findUnique>
        const mockReturnedPost = { id: 'mockPostId' };

        test('should get post successfully', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockReturnedPost as getPostType);
            // when
            const result = await postsService.getPost(mockPostId);
            // then
            expect(result.post).toStrictEqual(mockReturnedPost);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockPostId },
                include: {
                    tags: true,
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
                },
            });
        });

        test('should throw error if post is not found', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.getPost).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
        });
    });
    //
});
