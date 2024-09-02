import { PostsService } from '../../../../src/domain/posts/posts.service';
import { prismaMock } from '../../../singleton';
import { Image, Post, Prisma, User } from '../../../../prisma/prisma-client';
import { CustomError } from '@utils/customError';
import { deleteImages } from '@utils/filesystem';
import { UsersService } from '../../../../src/domain/users/users.service';
import redisClientMock from '@utils/redis';

jest.mock('../../../../src/domain/users/users.service');
jest.mock('@utils/filesystem'); // 정확한 명칭으로 설정하니 에러가 사라짐.
jest.mock('@utils/redis');

describe('PostsService Main Functions', () => {
    let postsService: PostsService;
    let usersServiceMock: jest.Mocked<UsersService>;
    let mockData: any = {};

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsService = new PostsService(usersServiceMock);
        postsService.findPostById = jest.fn();
        // mock data
        mockData.userId = 'mockUserId';
        mockData.postId = 'mockPostId';
        mockData.returnedpost = {
            id: 'mockPostId',
            authorId: 'mockUserId',
            images: [{ url: 'a' }, { url: 'b' }],
            postLikes: [{ postId: mockData.postId, guestId: mockData.guestId }],
            _count: { postLikes: 3 },
            tags: [{ tagId: 'hi' }, { tagId: 'hello' }],
        };
        mockData.guestId = 'mockGuestId';
    });

    // --- CreatePost
    describe('createPost', () => {
        beforeEach(() => {
            mockData.createPostDto = {
                title: 'Test Title',
                content: 'Test Content',
                category: 'TestCategory',
                images: ['images url', 'images url'],
                tags: ['Tag1', 'Tag2'],
                next: 'Next id',
                prev: 'Prev id',
                draft: 'false',
                summary: 'Test summary',
            };
        });

        test('should create a post successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            // 아직 이해가 필요해!!!
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            prismaMock.post.create.mockResolvedValue({ id: 'newPostId' } as Post);
            // when
            const result = await postsService.createPost(mockData.userId, mockData.createPostDto);
            // then
            expect(result).toBe('newPostId');
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.create).toHaveBeenCalledWith({
                data: {
                    title: mockData.createPostDto.title,
                    content: mockData.createPostDto.content,
                    prev: mockData.createPostDto.prev,
                    next: mockData.createPostDto.next,
                    draft: mockData.createPostDto.draft,
                    summary: mockData.createPostDto.summary,
                    category: {
                        connectOrCreate: {
                            where: { name: mockData.createPostDto.category },
                            create: { name: mockData.createPostDto.category },
                        },
                    },
                    author: {
                        connect: { id: mockData.userId },
                    },
                    images: {
                        createMany: {
                            data: mockData.createPostDto.images.map((url: string) => ({ url })),
                        },
                    },
                },
            });
            expect(prismaMock.postTag.create).toHaveBeenCalledTimes(mockData.createPostDto.tags.length);
            expect(redisClientMock.del as jest.Mock).toHaveBeenCalledTimes(mockData.createPostDto.images.length);
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.createPost(mockData.userId, mockData.createPostDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(prismaMock.$transaction).not.toHaveBeenCalled(); // not
        });

        test('should rollback transaction on failure', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    return await callback(prismaMock);
                } catch (error) {
                    throw error;
                }
            });
            prismaMock.post.create.mockRejectedValue(new Error('데이터베이스: 게시글 생성 오류'));
            // when, then
            await expect(postsService.createPost(mockData.userId, mockData.createPostDto)).rejects.toEqual(new Error('데이터베이스: 게시글 생성 오류'));
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.create).toHaveBeenCalled();
            expect(redisClientMock.del as jest.Mock).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- UpdatePost
    describe('update', () => {
        type PostIncludingImageType = Post & { images: Pick<Image, 'url'>[] }
        beforeEach(() => {
            mockData.updatePostDto = {
                title: 'Test Title',
                content: 'Test Content',
                category: 'TestCategory',
                images: ['b', 'c', 'e'],
                tags: ['Tag1', 'Tag2'],
                next: 'Next id',
                prev: 'Prev id',
                draft: 'false',
                summary: 'Test Summary',
            };
        });

        test('should update a post successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            // (deleteImages as jest.Mock).mockResolvedValue([]);
            // when
            await postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(postsService.findPostById).toHaveBeenCalledWith(mockData.postId, { images: true });
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.image.deleteMany).toHaveBeenCalledWith({
                where: { postId: mockData.returnedpost.id },
            });
            expect(prismaMock.postTag.deleteMany).toHaveBeenCalledWith({
                where: { postId: mockData.returnedpost.id },
            });
            expect(prismaMock.postTag.create).toHaveBeenCalledTimes([...new Set(mockData.updatePostDto.tags)].length);
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalledWith({
                where: {
                    posts: {
                        none: {},
                    },
                },
            });
            expect(deleteImages).toHaveBeenCalledWith([{ url: 'a' }]);
            expect(redisClientMock.del as jest.Mock).toHaveBeenCalledTimes(mockData.updatePostDto.images.length);
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).not.toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should throw error if user does not have permission', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            mockData.returnedpost.authorId = 'wrongUser'; // 틀린 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            // when, then
            await expect(postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should rollback transaction on failure', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    return await callback(prismaMock);
                } catch (error) {
                    throw error;
                }
            });
            prismaMock.post.update.mockRejectedValue(new Error('데이터베이스: 게시글 업데이트 오류'));
            // when, then
            await expect(postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto)).rejects.toEqual(
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
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                return callback(prismaMock);
            });
            (deleteImages as jest.Mock).mockRejectedValue(new Error('파일을 삭제하지 못했습니다'));
            // when, then
            await expect(postsService.updatePost(mockData.userId, mockData.postId, mockData.updatePostDto)).rejects.toThrow(
                new CustomError(500, 'Internal Server Error', `${new Error('파일을 삭제하지 못했습니다')}`),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(prismaMock.post.update).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalled();
            expect(deleteImages).toHaveBeenCalled();
            expect(redisClientMock.del as jest.Mock).not.toHaveBeenCalled();

        });
    });
    // ---

    // --- DeletePost
    describe('deletePost', () => {
        type PostIncludingImageType = Post & { images: Pick<Image, 'url'>[] }

        test('should delete a post successfully', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            (deleteImages as jest.Mock).mockResolvedValue([]);
            // when
            await postsService.deletePost(mockData.userId, mockData.postId);
            // then
            expect(postsService.findPostById).toHaveBeenCalledWith(mockData.postId, { images: true });
            expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id: mockData.returnedpost.id } });
            expect(prismaMock.tag.deleteMany).toHaveBeenCalledWith({ where: { posts: { none: {} } } });
            expect(deleteImages).toHaveBeenCalledWith(mockData.returnedpost.images);
        });

        test('should throw error if post is not found', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.deletePost(mockData.userId, mockData.postId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if user dose not have permission', async () => {
            // given
            mockData.returnedpost.authorId = 'wrongUser'; // 틀린 아이디 주입
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            // when, then
            await expect(postsService.deletePost(mockData.userId, mockData.postId)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).not.toHaveBeenCalled();
        });

        test('should throw error if images fail to delete', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost as PostIncludingImageType);
            (deleteImages as jest.Mock).mockRejectedValue(new Error('파일을 삭제하지 못했습니다'));
            // when, then
            await expect(postsService.deletePost(mockData.userId, mockData.postId)).rejects.toThrow(
                new CustomError(500, 'Internal Server Error', `${new Error('파일을 삭제하지 못했습니다')}`),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.post.delete).toHaveBeenCalled();
            expect(prismaMock.tag.deleteMany).toHaveBeenCalled();
            expect(deleteImages).toHaveBeenCalled();
        });
    });
    // ---

    // --- GetPosts
    describe('getPosts', () => {
        beforeEach(() => {
            mockData.skip = 3;
            mockData.take = 10;
            mockData.category = 'mockCategory';
            mockData.search = 'mockSearch';

            mockData.mockReturnedPosts = [
                { id: 'mockId1', tags: [{ tagId: 'hi' }, { tagId: 'hello' }] },
                { id: 'mockId2', tags: [{ tagId: 'hi' }, { tagId: 'hello' }] },
            ];
        });

        test('should get posts successfully', async () => {
            // given
            prismaMock.post.findMany.mockResolvedValue(mockData.mockReturnedPosts);
            // when
            const result = await postsService.getPosts(mockData.take, mockData.skip, mockData.search, mockData.category);
            // then
            const postList = mockData.mockReturnedPosts.map((post: any) => {
                const { tags, ...restPost } = post;
                return {
                    ...restPost,
                    tags: tags.map((tag: any) => tag.tagId),
                };
            });
            expect(result.posts).toStrictEqual(postList);
            expect(result.postCount).toBe(mockData.mockReturnedPosts.length);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: mockData.search } },
                        { content: { contains: mockData.search } },
                    ],
                    category: { name: mockData.category },
                },
                select: {
                    id: true,
                    title: true,
                    summary: true,
                    createdAt: true,
                    tags: {
                        select: {
                            tagId: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc', // 내림, 최신순
                },
                skip: mockData.skip,
                take: mockData.take,
            });
        });

        test('should get posts successfully even if category is falsy value', async () => {
            // given
            mockData.category = '';
            prismaMock.post.findMany.mockResolvedValue(mockData.mockReturnedPosts);
            // when
            const result = await postsService.getPosts(mockData.take, mockData.skip, mockData.search, mockData.category);
            // then
            const postList = mockData.mockReturnedPosts.map((post: any) => {
                const { tags, ...restPost } = post;
                return {
                    ...restPost,
                    tags: tags.map((tag: any) => tag.tagId),
                };
            });
            expect(result.posts).toStrictEqual(postList);
            expect(result.postCount).toBe(mockData.mockReturnedPosts.length);
            expect(prismaMock.post.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { title: { contains: mockData.search } },
                        { content: { contains: mockData.search } },
                    ],
                    category: {}, // 만약 undefined 이라면
                },
                select: {
                    id: true,
                    title: true,
                    summary: true,
                    createdAt: true,
                    tags: {
                        select: {
                            tagId: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc', // 내림, 최신순
                },
                skip: mockData.skip,
                take: mockData.take,
            });
        });
    });
    // ---

    // --- GetPost
    describe('getPost', () => {
        test('should get post successfully', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockData.returnedpost);
            // when
            const result = await postsService.getPost(mockData.postId, mockData.guestId);
            // then
            const { postLikes, _count: { postLikes: postLikeCount }, tags, ...restPost } = mockData.returnedpost;
            const tagList = tags.map((el: { tagId: string; }) => el.tagId);
            expect(result).toStrictEqual({ post: { ...restPost, tags: tagList, postLikeCount, isLiked: true } });
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: {
                    id: mockData.postId,
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    prev: true,
                    next: true,
                    draft: true,
                    summary: true,
                    categoryName: true,
                    createdAt: true,
                    updatedAt: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    tags: {
                        select: {
                            tagId: true,
                        },
                    },
                    _count: {
                        select: { postLikes: true },
                    },
                    postLikes: {
                        select: {
                            guestId: true,
                        },
                    },
                    images: {
                        select: {
                            id: true,
                            url: true,
                        },
                    },
                    comments: {
                        where: {
                            parentCommentId: null,
                        },
                        select: {
                            id: true,
                            content: true,
                            author: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                            guest: {
                                select: {
                                    id: true,
                                    nickName: true,
                                },
                            },
                            childComments: {
                                select: {
                                    id: true,
                                    content: true,
                                    author: {
                                        select: {
                                            id: true,
                                            name: true,
                                        },
                                    },
                                    guest: {
                                        select: {
                                            id: true,
                                            nickName: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });
        });

        test('should throw error if post is not found', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.getPost(mockData.postId, mockData.guestId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
        });
    });
    //

    // --- PostLike
    describe('postLike', () => {
        beforeEach(() => {
            mockData.postLikeDto = {
                postId: 'mockPostId',
                tryToLike: true,
                guestLikeId: 'mockGuestLikeId',
            };
            mockData.returnedGuestLike = { id: 'mockGuestLikeId' };
        });

        // I. falsy, true => 좋아요 생성(isLiked === null), postLikeGuestId 생성 O
        test('should create a postLike if tryToLike is true and postLikeGuestId is falsy value', async () => {
            // given
            mockData.postLikeDto.tryToLike = true;
            mockData.postLikeDto.guestLikeId = undefined;
            usersServiceMock.createGuestLike.mockResolvedValue('mockGuestLikeId');
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            usersServiceMock.findGuestLikeById.mockResolvedValue(mockData.returnedGuestLike);
            // when
            const result = await postsService.postLike(mockData.postLikeDto);
            // then
            expect(result).toStrictEqual('mockGuestLikeId');
            expect(postsService.findPostById as jest.Mock).toHaveBeenCalledWith(mockData.postLikeDto.postId);
            expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
                where: {
                    postId_guestId: {
                        postId: mockData.returnedpost.id,
                        guestId: mockData.postLikeDto.guestLikeId,
                    },
                },
            });
            expect(usersServiceMock.findGuestLikeById).toHaveBeenCalledWith(mockData.postLikeDto.guestLikeId);
            expect(prismaMock.postLike.create).toHaveBeenCalledWith({
                data: {
                    post: { connect: { id: mockData.returnedpost.id } },
                    guest: { connect: { id: mockData.returnedGuestLike.id } },
                },
            });
            expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
        });

        // I. truthy, true => 좋아요 생성(isLiked === null), postLikeGuestId 생성 X
        test('should create a postLike if tryToLike is true and postLike is truthy value', async () => {
            // given
            mockData.postLikeDto.tryToLike = true;
            mockData.postLikeDto.guestLikeId = 'mockGuestLikeId';
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            usersServiceMock.findGuestLikeById.mockResolvedValue(mockData.returnedGuestLike);
            // when
            const result = await postsService.postLike(mockData.postLikeDto);
            // then
            expect(result).toStrictEqual('mockGuestLikeId');
            expect(postsService.findPostById as jest.Mock).toHaveBeenCalled();
            expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
            expect(usersServiceMock.findGuestLikeById).toHaveBeenCalled();
            expect(prismaMock.postLike.create).toHaveBeenCalled();
            expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
        });

        // I. truthy, false => 좋아요 삭제(isLiked !== null)
        test('should delete a postLike if tryToLike is false and postLike is truthy value', async () => {
            // given
            mockData.postLikeDto.guestLikeId = 'mockGuestLikeId';
            mockData.postLikeDto.tryToLike = false;
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost);
            prismaMock.postLike.findUnique.mockResolvedValue({ postId: 'mockPostId', guestId: mockData.guestId });
            // when
            const result = await postsService.postLike(mockData.postLikeDto);
            // then
            expect(result).toBeNull();
            expect(prismaMock.postLike.create).not.toHaveBeenCalled();
            expect(prismaMock.postLike.delete).toHaveBeenCalledWith({
                where: {
                    postId_guestId: {
                        postId: mockData.returnedpost.id,
                        guestId: mockData.postLikeDto.guestLikeId,
                    },
                },
            });
            expect(prismaMock.guestLike.deleteMany).toHaveBeenCalledWith({
                where: {
                    postLikes: { none: {} },
                },
            });
        });

        // I. falsy, false => 잘못된 요청
        test('1: should throw error if client sends an invalid request', async () => {
            // given
            mockData.postLikeDto.guestLikeId = '';
            mockData.postLikeDto.tryToLike = false;
            // when, then
            await expect(postsService.postLike(mockData.postLikeDto)).rejects.toThrow(
                new CustomError(400, 'Bad Request', '잘못된 요청입니다'),
            );
            expect(postsService.findPostById).not.toHaveBeenCalled();
        });

        // I. 그 외 잘못된 요청
        test('2: should throw error if client sends an invalid request', async () => {
            // given
            mockData.postLikeDto.guestLikeId = 'mockPostLikeGuestId';
            mockData.postLikeDto.tryToLike = false;
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.postLike(mockData.postLikeDto)).rejects.toThrow(
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
            await expect(postsService.postLike(mockData.postLikeDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.postLike.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if guest is not found', async () => {
            // given
            (postsService.findPostById as jest.Mock).mockResolvedValue(mockData.returnedpost);
            prismaMock.postLike.findUnique.mockResolvedValue(null);
            (usersServiceMock.findGuestLikeById as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', 'guestLikeId 를 찾을 수 없습니다'),
            );
            // when, then
            await expect(postsService.postLike(mockData.postLikeDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', 'guestLikeId 를 찾을 수 없습니다'),
            );
            expect(postsService.findPostById).toHaveBeenCalled();
            expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
            expect(usersServiceMock.findGuestLikeById).toHaveBeenCalled();
            expect(prismaMock.postLike.create).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- UploadImage
    describe('uploadImage', () => {
        beforeEach(() => {
            mockData.file = { path: 'mock/url.jpg' };
        });

        test('should upload a image successfully', async () => {
            // when
            const result = await postsService.uploadImage(mockData.file);
            // then
            expect(result).toStrictEqual(mockData.file.path);
            expect(redisClientMock.set).toHaveBeenCalledWith(`image:${mockData.file.path}`, '', { EX: 60 * 60 * 24 });
        });

        test('should throw error if file is undefined', async () => {
            // when, then
            await expect(postsService.uploadImage(undefined)).rejects.toThrow(
                new CustomError(400, 'Bad Request', '잘못된 요청입니다'),
            );
            expect(redisClientMock.set).not.toHaveBeenCalled();
        });
    });
    // ---
});

describe('PostsService Util Functions', () => {
    let postsService: PostsService;
    let usersServiceMock: jest.Mocked<UsersService>;
    let mockData: any = {};

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsService = new PostsService(usersServiceMock);
    });

    // --- FindPostById
    describe('findPostById', () => {
        type GetPostType = Prisma.PromiseReturnType<typeof prismaMock.post.findUnique>
        type PostWithImages = GetPostType & { images: [] }
        beforeEach(() => {
            mockData.postId = 'mockPostId';
            mockData.returnedPost = { id: 'mockPostId' };
            mockData.returnedPostWithImages = { id: 'mockPostId', images: [] };
        });

        test('should get a post successfully without includeOptions', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockData.returnedPost as GetPostType);
            // when
            const result = await postsService.findPostById(mockData.postId);
            // then
            expect(result).toStrictEqual(mockData.returnedPost);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockData.postId },
                include: {},
            });
        });

        test('should get a post successfully with includeOptions', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(mockData.returnedPostWithImages as PostWithImages);
            // when
            const result = await postsService.findPostById(mockData.postId, { images: true });
            // then
            expect(result).toStrictEqual(mockData.returnedPostWithImages);
            expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
                where: { id: mockData.postId },
                include: { images: true },
            });
        });

        test('should throw error if post is not found', async () => {
            // given
            prismaMock.post.findUnique.mockResolvedValue(null);
            // when, then
            await expect(postsService.findPostById(mockData.postId, { images: true })).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(prismaMock.post.findUnique).toHaveBeenCalled();
        });
    });
    // ---
});
