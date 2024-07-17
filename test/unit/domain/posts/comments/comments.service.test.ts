import { CommentsService } from '../../../../../src/domain/posts/comments/comments.service';
import { UsersService } from '../../../../../src/domain/users/users.service';
import { PostsService } from '../../../../../src/domain/posts/posts.service';
import { Post, User, Comment, Prisma } from '@prisma';
import { prismaMock } from '../../../../singleton';
import { PromiseReturnType } from 'prisma/prisma-client/scripts/default-index';
import { CustomError } from '@utils/customError';

jest.mock('../../../../../src/domain/users/users.service');
jest.mock('../../../../../src/domain/posts/posts.service');


describe('CommentsService', () => {
    let commentsService: CommentsService;
    let usersServiceMock: jest.Mocked<UsersService>;
    let postsServiceMock: jest.Mocked<PostsService>;
    let mockData: any = {};

    beforeEach(() => {
        usersServiceMock = jest.mocked(new UsersService()) as jest.Mocked<UsersService>;
        postsServiceMock = jest.mocked(new PostsService(new UsersService())) as jest.Mocked<PostsService>;
        commentsService = new CommentsService(usersServiceMock, postsServiceMock);
    });

    // --- CreateComment
    describe('createComment', () => {
        type FindPostByIdType = Prisma.PromiseReturnType<typeof postsServiceMock.findPostById>
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
});
