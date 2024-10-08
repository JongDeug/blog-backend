import {
    CreateChildCommentDto,
    CreateChildCommentGuestDto,
    CreateCommentDto,
    CreateCommentGuestDto,
    DeleteCommentGuestDto,
    UpdateCommentDto,
    UpdateCommentGuestDto,
} from './dto';
import { UsersService } from '../../users/users.service';
import { PostsService } from '../posts.service';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import transporter from '@utils/nodemailer';
import { CustomError } from '@utils/customError';
import {
    GuestComment,
    Prisma,
    Comment,
    User,
} from '../../../../prisma/prisma-client';
import ROLES from '@utils/roles';

interface ExtendedComment extends Comment {
    guest: GuestComment | null;
    childComments: (Comment & { guest?: GuestComment })[];
    post: { title: string };
}

export class CommentsService {
    constructor(
        private readonly usersService: UsersService,
        private readonly postsService: PostsService
    ) {}

    // 회원
    async createComment(userId: string, dto: CreateCommentDto) {
        // I. user 확인
        const user = await this.usersService.findUserById(userId);
        // I. post 확인
        const post = await this.postsService.findPostById(dto.postId);

        // I. 새로운 comment 생성
        const newComment = await database.comment.create({
            data: {
                content: dto.content,
                author: {
                    connect: {
                        id: user.id,
                    },
                },
                post: {
                    connect: {
                        id: post.id,
                    },
                },
            },
        });

        return newComment.id;
    }

    async createCommentGuest(dto: CreateCommentGuestDto) {
        // I. post 확인
        const post = await this.postsService.findPostById(dto.postId);

        // I. Transaction
        // I. Guest 하나당 댓글 하나
        const { newComment, guest } = await database.$transaction(
            async (database) => {
                // I. guest 생성
                const hashedPwd = await bcrypt.hash(
                    dto.password,
                    Number(process.env.PASSWORD_SALT)
                );
                const guest = await this.usersService.createGuestComment(
                    dto.nickName,
                    dto.email,
                    hashedPwd
                );

                // I. 댓글 생성
                const newComment = await database.comment.create({
                    data: {
                        content: dto.content,
                        guest: {
                            connect: {
                                id: guest.id,
                            },
                        },
                        post: {
                            connect: {
                                id: post.id,
                            },
                        },
                    },
                });

                return { newComment, guest };
            }
        );

        // I. 트랜잭션이 성공하면 블로그 주인에게 이메일 보내기
        this.sendMail([process.env.MAIL_ID!], {
            nickName: guest.nickName,
            postTitle: post.title,
            postId: post.id,
        });

        return { newCommentId: newComment.id, guestCommentId: guest.id };
    }

    // 회원
    async createChildComment(userId: string, dto: CreateChildCommentDto) {
        // I. user 찾기
        const user = await this.usersService.findUserById(userId);

        // I. parent comment 찾기
        const parentComment: ExtendedComment = await this.findComment(
            { id: dto.parentCommentId },
            {
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
            }
        );

        // I. 대댓글 생성
        const newChildComment = await database.comment.create({
            data: {
                content: dto.content,
                post: {
                    connect: { id: parentComment.postId },
                },
                author: {
                    connect: { id: user.id },
                },
                parentComment: {
                    connect: { id: parentComment.id },
                },
            },
        });

        // I. 메일 보내기(부모 댓글 작성자, 자식 댓글 작성자)
        let mailList: string[] = [];
        if (parentComment.guest?.email)
            mailList.push(parentComment.guest.email); // 댓글 작성자가 회원이면 guest 존재하지 않으므로 처리
        parentComment.childComments.forEach((childComment) =>
            mailList.push(childComment.guest!.email)
        );
        this.sendMail(mailList, {
            nickName: 'Jongdeug',
            postTitle: parentComment.post.title,
            postId: parentComment.postId,
        });

        return newChildComment.id;
    }

    async createChildCommentGuest(dto: CreateChildCommentGuestDto) {
        // I. parent comment 찾기
        const parentComment: ExtendedComment = await this.findComment(
            { id: dto.parentCommentId },
            {
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
            }
        );

        // I. Transaction
        const { newChildComment, guest } = await database.$transaction(
            async (database) => {
                // I. guest 생성
                const hashedPwd = await bcrypt.hash(
                    dto.password,
                    Number(process.env.PASSWORD_SALT)
                );
                const guest = await this.usersService.createGuestComment(
                    dto.nickName,
                    dto.email,
                    hashedPwd
                );

                // I. 대댓글 생성
                const newChildComment = await database.comment.create({
                    data: {
                        content: dto.content,
                        guest: {
                            connect: { id: guest.id },
                        },
                        post: {
                            connect: { id: parentComment.postId },
                        },
                        parentComment: {
                            connect: { id: parentComment.id },
                        },
                    },
                });

                return { newChildComment, guest };
            }
        );

        // I. 메일 보내기 (블로그 주인, 부모 댓글 작성자(내가 작성한거면 메일 x), 자식 댓글 작성자들(내가 작성한거면 메일 x))
        let mailList = [process.env.MAIL_ID!];
        if (
            parentComment.guest?.email &&
            parentComment.guest.email !== guest.email
        )
            mailList.push(parentComment.guest.email);
        parentComment.childComments.forEach((childComment) => {
            if (childComment.guest!.email !== guest.email)
                mailList.push(childComment.guest!.email);
        });
        this.sendMail(mailList, {
            nickName: guest.nickName,
            postTitle: parentComment.post.title,
            postId: parentComment.postId,
        });

        return {
            newChildCommentId: newChildComment.id,
            guestCommentId: guest.id,
            postId: parentComment.postId,
        };
    }

    // ----

    async updateComment(
        userId: string,
        commentId: string,
        dto: UpdateCommentDto
    ) {
        // I. user 검색
        const user = await this.usersService.findUserById(userId);
        // I. comment 검색
        const comment = await this.findComment({ id: commentId });

        // I. 권한 인증 (comment.authorId <=> user)
        if (comment.authorId !== user.id)
            throw new CustomError(
                403,
                'Forbidden',
                '댓글에 대한 권한이 없습니다'
            );

        // I. 댓글 수정
        await database.comment.update({
            where: { id: comment.id },
            data: { content: dto.content },
        });
    }

    async updateCommentGuest(commentId: string, dto: UpdateCommentGuestDto) {
        // I. comment 검색
        const comment: ExtendedComment = await this.findComment(
            { id: commentId, authorId: null },
            { guest: true }
        );

        // I. 타입 체킹을 위해
        if (!comment?.guest)
            throw new CustomError(
                500,
                'Internal Server Error',
                '비회원 댓글 작성자를 찾고 있지 못하고 있음'
            );

        // I. 비밀번호 권한 인증
        const isCorrect = await bcrypt.compare(
            dto.password,
            comment.guest.password
        );
        if (!isCorrect)
            throw new CustomError(
                401,
                'Unauthorized',
                '비밀번호를 잘못 입력하셨습니다'
            );

        // I. 댓글 수정
        await database.comment.update({
            where: { id: comment.id },
            data: { content: dto.content },
        });
    }

    // ----

    async deleteComment(user: User, commentId: string) {
        // I. user 검색
        const foundUser = await this.usersService.findUserById(user.id);
        // I. comment 검색
        const comment = await this.findComment({ id: commentId });

        // I. 권한 확인 (user 가 admin 이면 모두 통과)
        if (
            foundUser.role === ROLES.admin ||
            foundUser.id === comment.authorId
        ) {
            // I. 댓글 삭제
            await database.comment.delete({
                where: {
                    id: comment.id,
                },
            });

            // I. admin 이 비회원 댓글을 삭제했을 수 있으므로,
            // I. 참조가 없는 guest 삭제, 대댓글이 포함되어 있는 댓글 삭제 시 해당 guests 삭제
            await database.guestComment.deleteMany({
                where: {
                    comment: null,
                },
            });
        }
        // I. 권한 확인
        else {
            throw new CustomError(
                403,
                'Forbidden',
                '댓글에 대한 권한이 없습니다'
            );
        }
    }

    async deleteCommentGuest(commentId: string, dto: DeleteCommentGuestDto) {
        // I. comment 찾기(유저가 작성한 comment 는 뺌)
        const comment = await this.findComment(
            { id: commentId, authorId: null },
            { guest: true }
        );

        // I. 타입 체킹을 위해
        if (!comment?.guest)
            throw new CustomError(
                500,
                'Internal Server Error',
                '비회원 댓글 작성자를 찾고 있지 못하고 있음'
            );

        // I. 권한 인증
        const isCorrect = await bcrypt.compare(
            dto.password,
            comment.guest.password
        );
        if (!isCorrect)
            throw new CustomError(
                401,
                'Unauthorized',
                '비밀번호를 잘못 입력하셨습니다'
            );

        // I. 댓글 삭제
        await database.comment.delete({
            where: {
                id: comment.id,
            },
        });

        // I. 참조가 없는 guest 삭제 => 대댓글이 포함되어 있는 댓글 삭제시, 그 guest 들도 삭제
        await database.guestComment.deleteMany({
            where: {
                comment: null,
            },
        });

        return { guestCommentId: comment.guestId!, postId: comment.postId };
    }

    /**
     * [Utils]
     * sendMail : 댓글 알림 메일 보내는 함수
     * findComment : 댓글 검색 함수
     */
    sendMail(to: string[], payload: { nickName: string; postTitle: string, postId: string }) {
        if (to.length > 0) {
            const mailOptions = {
                from: process.env.MAIL_ID,
                to, // 수신자 이메일 주소
                subject: '블로그 댓글 알림 메일',
                html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">Jongdeug's Blog</h2>
                    <p>${payload.nickName}님이 "${payload.postTitle}" 게시물에 댓글을 달았습니다.</p>
                    <br>
                    <p><a href="https://jongdeug.port0.org/blog/${payload.postId}">바로가기</a>.</p>
                    </div>
                </div>
            `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    throw new CustomError(
                        500,
                        'Internal Server Error',
                        error.message
                    );
                }
            });
        }
    }

    async findComment(
        whereOptions: Prisma.CommentWhereUniqueInput,
        includeOptions: Prisma.CommentInclude = {}
    ) {
        const comment = await database.comment.findUnique({
            where: { ...whereOptions },
            include: { ...includeOptions },
        });

        if (!comment)
            throw new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다');

        return comment;
    }
}
