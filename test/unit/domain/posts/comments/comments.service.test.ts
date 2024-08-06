import { CommentsService } from '../../../../../src/domain/posts/comments/comments.service';
import { UsersService } from '../../../../../src/domain/users/users.service';
import { PostsService } from '../../../../../src/domain/posts/posts.service';
import { User, Comment, Prisma } from '@prisma';
import { prismaMock } from '../../../../singleton';
import { CustomError } from '@utils/customError';
import bcrypt from 'bcrypt';
import process from 'node:process';
import transporter from '@utils/nodemailer';

jest.mock('../../../../../src/domain/users/users.service');
jest.mock('../../../../../src/domain/posts/posts.service');
jest.mock('bcrypt');
jest.mock('@utils/nodemailer');


describe('CommentsService Main Functions', () => {
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
        commentsService.sendMail = jest.fn();
        commentsService.findComment = jest.fn();
        mockData.userId = 'mockUserId';
        mockData.commentId = 'mockCommentId';
        mockData.returnedParentComment = {
            postId: 'mockPostId',
            id: 'mockCommentId',
            guest: {
                email: 'mockEmail1',
            },
            post: {
                title: 'mockPostTitle',
            },
            childComments: [
                { guest: { email: 'mockEmail2' } },
                { guest: { email: 'mockEmail3' } },
            ],
        };
    });

    // --- CreateComment
    describe('createComment', () => {
        beforeEach(() => {
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
            mockData.returnedGuest = {
                id: 'mockGuestId',
                email: mockData.createCommentGuestDto.email,
                nickName: mockData.createCommentGuestDto.nickName,
            };
        });

        test('should create a guest comment successfully', async () => {
            // given
            postsServiceMock.findPostById.mockResolvedValue({
                id: mockData.createCommentGuestDto.postId,
                title: 'mockPostTitle',
            } as FindPostByIdType);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newCommentId' } as CreateComment);
            // when
            const result = await commentsService.createCommentGuest(mockData.createCommentGuestDto);
            // then
            expect(result).toStrictEqual({ newCommentId: 'newCommentId', guestCommentId: 'mockGuestId' });
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
            expect(commentsService.sendMail).toHaveBeenCalledWith([process.env.MAIL_ID], {
                nickName: mockData.returnedGuest.nickName,
                postTitle: 'mockPostTitle',
            });
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
            (commentsService.sendMail as jest.Mock).mockImplementation(() => {
                throw new Error('이메일: 전송 에러');
            });
            // when, then
            await expect(commentsService.createCommentGuest(mockData.createCommentGuestDto)).rejects.toThrow(
                new Error('이메일: 전송 에러'),
            );
            expect(postsServiceMock.findPostById).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(commentsService.sendMail).toHaveBeenCalled();
        });
    });
    // ---

    // --- CreateChildComment
    describe('createChildComment', () => {
        beforeEach(() => {
            mockData.createChildCommentDto = {
                parentCommentId: 'mockParentCommentId',
                content: 'mockContent',
            };
        });

        // I. 부모 댓글을 비회원이 쓴 경우
        test('should create a child comment successfully if parent comment was created by guest', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            // when
            const result = await commentsService.createChildComment(mockData.userId, mockData.createChildCommentDto);
            // then
            expect(result).toStrictEqual('newChildCommentId');
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(commentsService.findComment).toHaveBeenCalledWith({ id: mockData.createChildCommentDto.parentCommentId }, {
                guest: true,
                post: {
                    select: {
                        title: true,
                    },
                },
                childComments: {
                    where: {
                        authorId: null, // I. guest 만 쭉 뽑기 => 이메일 보내야 함
                    },
                    include: {
                        guest: true,
                    },
                },
            });
            expect(prismaMock.comment.create).toHaveBeenCalledWith({
                data: {
                    content: mockData.createChildCommentDto.content,
                    post: {
                        connect: { id: mockData.returnedParentComment.postId },
                    },
                    author: {
                        connect: { id: mockData.userId },
                    },
                    parentComment: {
                        connect: { id: mockData.returnedParentComment.id },
                    },
                },
            });
            expect(commentsService.sendMail).toHaveBeenCalledWith(['mockEmail1', 'mockEmail2', 'mockEmail3'], {
                nickName: 'Jongdeug',
                postTitle: mockData.returnedParentComment.post.title,
            });
        });

        // I. 부모 댓글을 회원(블로그 주인)이 쓴 경우
        test('should create a child comment successfully if parent comment was created by user', async () => {
            // given
            mockData.returnedParentComment.guest = undefined;
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            // when
            const result = await commentsService.createChildComment(mockData.userId, mockData.createChildCommentDto);
            // then
            expect(result).toStrictEqual('newChildCommentId');
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(commentsService.sendMail).toHaveBeenCalledWith(['mockEmail2', 'mockEmail3'], {
                nickName: 'Jongdeug',
                postTitle: mockData.returnedParentComment.post.title,
            });
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.createChildComment(mockData.userId, mockData.createCommentDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).not.toHaveBeenCalled();
        });

        test('should throw error if parent comment is found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            await expect(commentsService.createChildComment(mockData.userId, mockData.createChildCommentDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).not.toHaveBeenCalled();
        });

        test('should log error if email sending fails', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: mockData.userId } as User);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            (commentsService.sendMail as jest.Mock).mockImplementation(() => {
                throw new Error('이메일: 전송 에러');
            });
            // when, then
            await expect(commentsService.createChildComment(mockData.userId, mockData.createChildCommentDto)).rejects.toThrow(
                new Error('이메일: 전송 에러'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(commentsService.sendMail).toHaveBeenCalled();
        });
    });
    // ---

    // --- CreateChildCommentGuest
    describe('createChildCommentGuest', () => {
        beforeEach(() => {
            mockData.createChildCommentGuestDto = {
                parentCommentId: 'mockParentCommentId',
                content: 'mockContent',
                nickName: 'mockNickName',
                email: 'mockEmail',
                password: 'mockPassword',
            };
            mockData.returnedGuest = {
                id: 'mockGuestCommentId',
                email: mockData.createChildCommentGuestDto.email,
                nickName: mockData.createChildCommentGuestDto.nickName,
            };
        });

        // I. 부모 댓글을 비회원이 쓴 경우
        test('should create a guest child comment successfully if parent comment was created by guest', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            // when
            const result = await commentsService.createChildCommentGuest(mockData.createChildCommentGuestDto);
            // then
            expect(result).toStrictEqual({
                newChildCommentId: 'newChildCommentId',
                guestCommentId: mockData.returnedGuest.id,
                postId: mockData.returnedParentComment.postId,
            });
            expect(commentsService.findComment).toHaveBeenCalledWith({ id: mockData.createChildCommentGuestDto.parentCommentId }, {
                guest: true,
                post: {
                    select: {
                        title: true,
                    },
                },
                childComments: {
                    where: {
                        authorId: null, // I. guest 만 쭉 뽑기 => 이메일 보내야 함
                    },
                    include: {
                        guest: true,
                    },
                },
            });
            expect(bcrypt.hash).toHaveBeenCalledWith(mockData.createChildCommentGuestDto.password, Number(process.env.PASSWORD_SALT));
            expect(usersServiceMock.createGuestComment).toHaveBeenCalledWith(mockData.createChildCommentGuestDto.nickName, mockData.createChildCommentGuestDto.email, 'hashedPassword');
            expect(prismaMock.comment.create).toHaveBeenCalledWith({
                data: {
                    content: mockData.createChildCommentGuestDto.content,
                    guest: {
                        connect: { id: mockData.returnedGuest.id },
                    },
                    post: {
                        connect: { id: mockData.returnedParentComment.postId },
                    },
                    parentComment: {
                        connect: { id: mockData.returnedParentComment.id },
                    },
                },
            });
            expect(commentsService.sendMail).toHaveBeenCalledWith([process.env.MAIL_ID, 'mockEmail1', 'mockEmail2', 'mockEmail3'], {
                nickName: mockData.returnedGuest.nickName,
                postTitle: mockData.returnedParentComment.post.title,
            });
        });

        // I. 부모 댓글을 회원(블로그 주인)이 쓴 경우
        test('should create a guest child comment successfully if parent comment was created by user', async () => {
            // given
            mockData.returnedParentComment.guest = undefined;
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            // when
            const result = await commentsService.createChildCommentGuest(mockData.createChildCommentGuestDto);
            // then
            expect(result).toStrictEqual({
                newChildCommentId: 'newChildCommentId',
                guestCommentId: mockData.returnedGuest.id,
                postId: mockData.returnedParentComment.postId,
            });
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(commentsService.sendMail).toHaveBeenCalledWith([process.env.MAIL_ID, 'mockEmail2', 'mockEmail3'], {
                nickName: mockData.returnedGuest.nickName,
                postTitle: mockData.returnedParentComment.post.title,
            });
        });

        test('should throw error if parent comment is found', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.createChildCommentGuest(mockData.createChildCommentGuestDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        test('should rollback transaction on failure', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.$transaction.mockImplementation(async (callback) => {
                try {
                    return await callback(prismaMock);
                } catch (err) {
                    throw err;
                }
            });
            usersServiceMock.createGuestComment.mockRejectedValue(new Error('데이터베이스: 게스트 생성 오류'));
            // when, then
            await expect(commentsService.createChildCommentGuest(mockData.createChildCommentGuestDto)).rejects.toThrow(
                new Error('데이터베이스: 게스트 생성 오류'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).not.toHaveBeenCalled();
        });

        test('should log error if email sending fails', async () => {
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedParentComment);
            prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            usersServiceMock.createGuestComment.mockResolvedValue(mockData.returnedGuest);
            prismaMock.comment.create.mockResolvedValue({ id: 'newChildCommentId' } as Comment);
            // given
            (commentsService.sendMail as jest.Mock).mockImplementation(() => {
                throw new Error('이메일: 전송 에러');
            });
            // when, then
            await expect(commentsService.createChildCommentGuest(mockData.createChildCommentGuestDto)).rejects.toThrow(
                new Error('이메일: 전송 에러'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalled();
            expect(usersServiceMock.createGuestComment).toHaveBeenCalled();
            expect(prismaMock.comment.create).toHaveBeenCalled();
            expect(commentsService.sendMail).toHaveBeenCalled();
        });
    });
    // ---

    // --- UpdateComment
    describe('updateComment', () => {
        beforeEach(() => {
            mockData.updateCommentDto = { content: 'mockContent' };
            mockData.returnedComment = { id: 'mockCommentId', authorId: 'mockUserId' };
        });

        test('should update a comment successfully', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: 'mockUserId' } as User);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            // when
            await commentsService.updateComment(mockData.userId, mockData.commentId, mockData.updateCommentDto);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith(mockData.userId);
            expect(commentsService.findComment).toHaveBeenCalledWith({ id: mockData.commentId });
            expect(prismaMock.comment.update).toHaveBeenCalledWith({
                where: {
                    id: mockData.returnedComment.id,
                },
                data: {
                    content: mockData.updateCommentDto.content,
                },
            });
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.updateComment(mockData.userId, mockData.commentId, mockData.updateCommentDto)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).not.toHaveBeenCalled();
        });

        test('should throw error if comment is not found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: 'mockUserId' } as User);
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.updateComment(mockData.userId, mockData.commentId, mockData.updateCommentDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.update).not.toHaveBeenCalled();
        });

        test('should throw error if user is not author of comment', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue({ id: 'mockAnotherUser' } as User);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            // when, then
            await expect(commentsService.updateComment(mockData.userId, mockData.commentId, mockData.updateCommentDto)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '댓글에 대한 권한이 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.update).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- UpdateCommentGuest
    describe('updateCommentGuest', () => {
        beforeEach(() => {
            mockData.updateCommentGuestDto = {
                content: 'mockContent',
                password: 'mockPassword',
            };
            mockData.returnedComment = {
                id: mockData.commentId,
                guest: {
                    password: 'hashedPassword',
                },
            };
        });

        test('should update a guest comment successfully', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            // when
            await commentsService.updateCommentGuest(mockData.commentId, mockData.updateCommentGuestDto);
            // then
            expect(commentsService.findComment).toHaveBeenCalledWith({
                id: mockData.commentId,
                authorId: null,
            }, { guest: true });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockData.updateCommentGuestDto.password, mockData.returnedComment.guest.password);
            expect(prismaMock.comment.update).toHaveBeenCalledWith({
                where: { id: mockData.returnedComment.id },
                data: { content: mockData.updateCommentGuestDto.content },
            });
        });

        test('should throw error if comment is not found', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.updateCommentGuest(mockData.commentId, mockData.updateCommentGuestDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if comment.guest is null or undefined', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(null);
            // when, then
            await expect(commentsService.updateCommentGuest(mockData.commentId, mockData.updateCommentGuestDto)).rejects.toThrow(
                new CustomError(500, 'Internal Server Error', '비회원 댓글 작성자를 찾고 있지 못하고 있음'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if password is incorrect', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when, then
            await expect(commentsService.updateCommentGuest(mockData.commentId, mockData.updateCommentGuestDto)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '비밀번호를 잘못 입력하셨습니다'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).toHaveBeenCalled();
            expect(prismaMock.comment.update).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- DeleteComment
    describe('deleteComment', () => {
        beforeEach(() => {
            mockData.foundUser = {
                id: 'mockUserId',
                role: 200,
            };
            mockData.returnedComment = { id: mockData.commentId, authorId: 'mockUserId' };
        });

        test('should delete a comment successfully if user is admin', async () => {
            // given
            mockData.foundUser.role = 500;
            mockData.returnedComment.authorId = 'mockAnotherUserId';
            usersServiceMock.findUserById.mockResolvedValue(mockData.foundUser);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            // when
            await commentsService.deleteComment({ id: 'mockUserId' } as User, mockData.commentId);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith('mockUserId');
            expect(commentsService.findComment).toHaveBeenCalledWith({ id: mockData.commentId });
            expect(prismaMock.comment.delete).toHaveBeenCalledWith({
                where: {
                    id: mockData.returnedComment.id,
                },
            });
        });

        test('should delete a comment successfully if user is author of comment', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue(mockData.foundUser);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            // when
            await commentsService.deleteComment({ id: 'mockUserId' } as User, mockData.commentId);
            // then
            expect(usersServiceMock.findUserById).toHaveBeenCalledWith('mockUserId');
            expect(commentsService.findComment).toHaveBeenCalledWith({ id: mockData.commentId });
            expect(prismaMock.comment.delete).toHaveBeenCalledWith({
                where: {
                    id: mockData.returnedComment.id,
                },
            });
            expect(prismaMock.guestComment.deleteMany).toHaveBeenCalledWith({
                where: {
                    comment: null,
                },
            });
        });

        test('should throw error if user is not found', async () => {
            // given
            usersServiceMock.findUserById.mockRejectedValue(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.deleteComment({ id: 'mockUserId' } as User, mockData.commentId)).rejects.toThrow(
                new CustomError(404, 'User Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).not.toHaveBeenCalled();
        });

        test('should throw error if comment is not found', async () => {
            // given
            usersServiceMock.findUserById.mockResolvedValue(mockData.foundUser);
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.deleteComment({ id: 'mockUserId' } as User, mockData.commentId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.delete).not.toHaveBeenCalled();
        });

        test('should throw error if user is not author of comment', async () => {
            // given
            mockData.returnedComment.authorId = 'mockAnotherUserId';
            usersServiceMock.findUserById.mockResolvedValue(mockData.foundUser);
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            // when, then
            await expect(commentsService.deleteComment({ id: 'mockUserId' } as User, mockData.commentId)).rejects.toThrow(
                new CustomError(403, 'Forbidden', '권한이 없습니다'),
            );
            expect(usersServiceMock.findUserById).toHaveBeenCalled();
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(prismaMock.comment.delete).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- DeleteCommentGuest
    describe('deleteCommentGuest', () => {
        beforeEach(() => {
            mockData.deleteCommentGuestDto = {
                password: 'mockPassword',
            };
            mockData.returnedComment = {
                id: mockData.commentId,
                guestId: 'mockGuestId',
                postId: 'mockPostId',
                guest: { password: 'hashedPassword' },
            };
        });

        test('should delete a guest comment successfully', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            // when
            const result = await commentsService.deleteCommentGuest(mockData.commentId, mockData.deleteCommentGuestDto);
            // then
            expect(result).toStrictEqual({
                guestId: mockData.returnedComment.guestId,
                postId: mockData.returnedComment.postId,
            });
            expect(commentsService.findComment).toHaveBeenCalledWith(
                { id: mockData.commentId, authorId: null }, { guest: true },
            );
            expect(bcrypt.compare).toHaveBeenCalledWith(mockData.deleteCommentGuestDto.password, mockData.returnedComment.guest.password);
            expect(prismaMock.comment.delete).toHaveBeenCalledWith({
                where: {
                    id: mockData.returnedComment.id,
                },
            });
            expect(prismaMock.guestComment.deleteMany).toHaveBeenCalledWith({
                where: {
                    comment: null,
                },
            });
        });

        test('should throw error if comment is not found', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockRejectedValue(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            // when, then
            await expect(commentsService.deleteCommentGuest(mockData.deleteCommentGuestDto.password, mockData.returnedComment.guest.password)).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if comment.guest is null or undefined', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(null);
            // when, then
            await expect(commentsService.deleteCommentGuest(mockData.deleteCommentGuestDto.password, mockData.returnedComment.guest.password)).rejects.toThrow(
                new CustomError(500, 'Internal Server Error', '비회원 댓글 작성자를 찾고 있지 못하고 있음'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if password is incorrect', async () => {
            // given
            (commentsService.findComment as jest.Mock).mockResolvedValue(mockData.returnedComment);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when, then
            await expect(commentsService.deleteCommentGuest(mockData.deleteCommentGuestDto.password, mockData.returnedComment.guest.password)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '비밀번호를 잘못 입력하셨습니다'),
            );
            expect(commentsService.findComment).toHaveBeenCalled();
            expect(bcrypt.compare).toHaveBeenCalled();
            expect(prismaMock.comment.delete).not.toHaveBeenCalled();
        });
    });
    // ---
});

describe('CommentsService Util Functions', () => {
    let commentsService: CommentsService;
    let usersServiceMock: jest.Mocked<UsersService>;
    let postsServiceMock: jest.Mocked<PostsService>;
    let mockData: any = {};

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsServiceMock = jest.mocked(new PostsService(new UsersService())) as jest.Mocked<PostsService>;
        commentsService = new CommentsService(usersServiceMock, postsServiceMock);
    });

    // --- SendMail
    describe('sendMail', () => {
        beforeEach(() => {
            mockData.to = ['email1', 'email2', 'email3'];
            mockData.payload = { nickName: 'mockNickName', postTitle: 'mockPostTitle' };
        });

        test('should send mails successfully if to.length more than 1', () => {
            // given
            (transporter.sendMail as jest.Mock).mockImplementation((mailOptions, callback) => {
                callback(null, { response: 'OK' });
            });
            // when
            commentsService.sendMail(mockData.to, mockData.payload);
            // then
            expect(transporter.sendMail).toHaveBeenCalledWith({
                from: process.env.MAIL_ID,
                to: mockData.to, // 수신자 이메일 주소
                subject: '블로그 댓글 알림 메일',
                html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">Jongdeug's Blog</h2>
                    <p>${mockData.payload.nickName}님이 "${mockData.payload.postTitle}" 게시물에 댓글을 달았습니다.</p>
                    <br>
                    <p><a href="jongdeug">바로가기</a>.</p>
                    </div>
                </div>
            `,
            }, expect.any(Function));
        });

        test('should throw error if transporter.sendMail fails', () => {
            // given
            (transporter.sendMail as jest.Mock).mockImplementation((mailOptions, callback) => {
                callback(new Error('이메일 전송 실패'), null);
            });
            // when, then
            expect(() => commentsService.sendMail(mockData.to, mockData.payload)).toThrow(new CustomError(500, 'Internal Server Error', '이메일 전송 실패'));
            expect(transporter.sendMail).toHaveBeenCalled();
        });
    });
    // ---

    // --- FindComment
    describe('findComment', () => {
        beforeEach(() => {
            mockData.commentId = 'mockCommentId';
            mockData.returnedComment = {
                id: 'mockCommentId',
            };
        });

        test('should get a comment successfully', async () => {
            // given
            prismaMock.comment.findUnique.mockResolvedValue(mockData.returnedComment);
            // when
            const result = await commentsService.findComment({ id: mockData.commentId });
            // then
            expect(result).toStrictEqual(mockData.returnedComment);
            expect(prismaMock.comment.findUnique).toHaveBeenCalledWith({
                where: { id: mockData.commentId },
                include: {},
            });
        });

        test('should throw error if comment is not found', async () => {
            // given
            prismaMock.comment.findUnique.mockResolvedValue(null);
            // when, then
            await expect(commentsService.findComment({ id: mockData.commentId })).rejects.toThrow(
                new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다'),
            );
            expect(prismaMock.comment.findUnique).toHaveBeenCalled();
        });
    });
    // ---
});
