import { CommentsService } from '../../../../../src/domain/posts/comments/comments.service';
import { UsersService } from '../../../../../src/domain/users/users.service';
import { PostsService } from '../../../../../src/domain/posts/posts.service';
import { User, Comment, Prisma } from '@prisma';
import { prismaMock } from '../../../../singleton';
import { CustomError } from '@utils/customError';
import transporter from '@utils/nodemailer';
import bcrypt from 'bcrypt';

jest.mock('../../../../../src/domain/users/users.service');
jest.mock('../../../../../src/domain/posts/posts.service');
jest.mock('bcrypt');
jest.mock('@utils/nodemailer');


describe('CommentsService', () => {
    let commentsService: CommentsService;
    let usersServiceMock: jest.Mocked<UsersService>;
    let postsServiceMock: jest.Mocked<PostsService>;
    let mockData: any = {};
    type FindPostByIdType = Prisma.PromiseReturnType<typeof postsServiceMock.findPostById>
    type CreateComment = Prisma.PromiseReturnType<typeof prismaMock.comment.create>

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsServiceMock = jest.mocked(new PostsService(new UsersService())) as jest.Mocked<PostsService>;
        commentsService = new CommentsService(usersServiceMock, postsServiceMock);
    });

    // --- CreateComment
    describe('createComment', () => {
        beforeEach(() => {
            mockData.userId = 'mockUserId';
            mockData.createCommentDto = {
                postId: 'mockPostId',
                content: 'mockContent',
            };
        });

        test('should create a comment successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            postsServiceMock.findPostById.mockResolvedValue({ id: mockData.createCommentDto.postId } as FindPostByIdType);
            prismaMock.comment.create.mockResolvedValue({ id: 'mockCommentId' } as Comment);
            // when
            const result = await commentsService.createComment(mockData.userId, mockData.createCommentDto);
            // then
            expect(result).toEqual('mockCommentId');
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(postsServiceMock.findPostById).toHaveBeenCalledWith(mockData.createCommentDto.postId);
            expect(prismaMock.comment.create).toHaveBeenCalledWith({
                data: {
                    content: mockData.createCommentDto.content,
                    author: {
                        connect: {
                            id: mockData.userId,
                        },
                    },
                    post: {
                        connect: {
                            id: mockData.createCommentDto.postId,
                        },
                    },
                },
            });
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.createComment(mockData.userId, mockData.createCommentDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsServiceMock.findPostById).not.toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            postsServiceMock.findPostById.mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.createComment(mockData.userId, mockData.createCommentDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(postsServiceMock.findPostById).toHaveBeenCalled();
            expect(prismaMock.comment.create).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- CreateCommentGuest
    describe('createCommentGuest', () => {
        beforeEach(() => {
            mockData.createCommentGuestDto = {
                postId: 'mockPostId',
                content: 'mockContent',
                nickName: 'mockNickname',
                email: 'mockEmail',
                password: 'mockPassword',
            };
            mockData.returnedGuest = { id: 'mockGuestId', email: mockData.createCommentGuestDto.email };
        });

        test('should create a guest comment successfully', async () => {
            // given
            postsServiceMock.findPostById.mockResolvedValue({ id: mockData.createCommentGuestDto.postId } as FindPostByIdType);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newCommentId' } as CreateComment);
            (transporter.sendMail as jest.Mock).mockImplementation((mailOptions, callback) => {
                callback(null, {response: '잘 보내짐'});
            });
            // when
            const result = await commentsService.createCommentGuest(mockData.createCommentGuestDto);
            // then
            expect(result).toStrictEqual({ newCommentId: 'newCommentId', guestId: 'mockGuestId' });
            expect(postsServiceMock.findPostById).toHaveBeenCalledWith(mockData.createCommentGuestDto.postId);
            expect(bcrypt.hash).toHaveBeenCalledWith(mockData.createCommentGuestDto.password, Number(process.env.PASSWORD_SALT));
            expect(usersServiceMock.createGuestComment).toHaveBeenCalledWith(mockData.createCommentGuestDto.nickName, mockData.createCommentGuestDto.email, 'hashedPassword');
            expect(prismaMock.comment.create).toHaveBeenCalledWith({
                data: {
                    content: mockData.createCommentGuestDto.content,
                    guest: {
                        connect: {
                            id: mockData.returnedGuest.id,
                        },
                    },
                    post: {
                        connect: {
                            id: mockData.createCommentGuestDto.postId,
                        },
                    },
                },
            });
            expect(transporter.sendMail).toHaveBeenCalled();
        });

        test('should throw error if post is not found', async () => {
            // given
            postsServiceMock.findPostById.mockRejectedValue(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.createCommentGuest(mockData.createCommentGuestDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다'),
            );
            expect(postsServiceMock.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should rollback transaction on failure', async () => {
            // given
            postsServiceMock.findPostById.mockResolvedValue({ id: mockData.createCommentGuestDto.postId } as FindPostByIdType);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    return await callback(prismaMock);
                } catch (err) {
                    throw err;
                }
            });
            usersServiceMock.createGuestComment.mockRejectedValue(new Error('데이터베이스: 게스트 생성 오류'));
            // when, then
            await expect(commentsService.createCommentGuest(mockData.createCommentGuestDto)).rejects.toThrow(
                new Error('데이터베이스: 게스트 생성 오류'),
            );
            expect(postsServiceMock.findPostById).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).not.toHaveBeenCalled();
        });

        test('should log error if email sending fails', async () => {
            // given
            postsServiceMock.findPostById.mockResolvedValue({ id: mockData.createCommentGuestDto.postId } as FindPostByIdType);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newCommentId' } as CreateComment);
            (transporter.sendMail as jest.Mock).mockImplementation((mailOptions, callback) => {
                callback(new Error('이메일: 전송 에러').message);
            });
            // when
            await commentsService.createCommentGuest(mockData.createCommentGuestDto);
            // then
            expect(postsServiceMock.findPostById).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(transporter.sendMail).toHaveBeenCalled();
        });
    });
    // ---
});
