import { PostsService } from '../../../src/domain/posts/posts.service';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../singleton';
import { CreatePostDto } from '../../../src/domain/posts/dto';
import { Post, User } from '@prisma';
import prisma from '../../../src/utils/database';
import { CustomError } from '@utils';

jest.mock('../../../src/domain/auth/auth.service');

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
            expect(prismaMock.category.upsert).toHaveBeenCalledWith({
                where: { name: mockDto.category },
                update: {},
                create: { name: mockDto.category },
            });
            expect(prismaMock.post.create).toHaveBeenCalledWith({
                data: {
                    title: mockDto.title,
                    content: mockDto.content,
                    // I. 바로 categoryName 를 설정하면 무결성 유지가 되지 않음
                    category: {
                        connect: { name: mockDto.category },
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
            expect(prismaMock.tag.upsert).toHaveBeenCalledTimes(mockDto.tags!.length);
            expect(prismaMock.postTag.create).toHaveBeenCalledTimes(mockDto.tags!.length);
        });

        test('should throw error if user is not found', async () => {
            // given
            authServiceMock.findUserById.mockImplementation(() => {
                throw new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다');
            });
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
            expect(prismaMock.category.upsert).toHaveBeenCalledWith({
                where: { name: mockDto.category },
                update: {},
                create: { name: mockDto.category },
            });
            expect(prismaMock.post.create).toHaveBeenCalled();
        });
    });
    // ---
});
