import { PostsService } from '../../../src/domain/posts/posts.service';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../singleton';
import { CreatePostDto, UpdatePostDto } from '../../../src/domain/posts/dto';
import { Image, Post, User } from '@prisma';
import { CustomError } from '@utils/customError';
import { deleteImage } from '@utils/filesystem';

jest.mock('../../../src/domain/auth/auth.service');
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
            updatedAt: new Date().toISOString(),
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
            expect(prismaMock.post.update).toHaveBeenCalledWith({
                where: { id: mockPost.id },
                data: {
                    title: mockDto.title,
                    content: mockDto.content,
                    // I. category 는 post 기능에서 삭제하지 못함, 생성만 가능
                    category: {
                        connectOrCreate: {
                            where: { name: mockDto.category },
                            create: { name: mockDto.category },
                        },
                    },
                    images: {
                        createMany: {
                            data: mockDto.images.map(image => ({ url: image.path })),
                        },
                    },
                    updatedAt: mockDto.updatedAt,
                },
            });
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

});
