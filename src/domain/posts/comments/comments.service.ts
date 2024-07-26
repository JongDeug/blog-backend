import {
    CreateChildCommentDto,
    CreateChildCommentGuestDto,
    CreateCommentDto,
    CreateCommentGuestDto,
    UpdateCommentDto, UpdateCommentGuestDto,
} from './dto';
import { UsersService } from '../../users/users.service';
import { PostsService } from '../posts.service';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import transporter from '@utils/nodemailer';
import { CustomError } from '@utils/customError';
import { GuestComment, Prisma, Comment } from '@prisma';
import * as process from 'node:process';

interface ExtendedComment extends Comment {
    guest: GuestComment | null;
    childComments: (Comment & { guest?: GuestComment })[];
    post: { title: string };
}

export class CommentsService {

    constructor(private readonly usersService: UsersService, private readonly postsService: PostsService) {
    }

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
    };

    async createCommentGuest(dto: CreateCommentGuestDto) {
        // I. post 확인
        const post = await this.postsService.findPostById(dto.postId);

        // I. Transaction
        // I. Guest 하나당 댓글 하나
        const { newComment, guest } = await database.$transaction(async (database) => {
            // I. guest 생성
            const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
            const guest = await this.usersService.createGuestForComment(dto.nickName, dto.email, hashedPwd);

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
        });

        // I. 트랜잭션이 성공하면 블로그 주인에게 이메일 보내기
        this.sendMail([process.env.MAIL_ID!], { nickName: guest.nickName, postTitle: post.title });

        return { newCommentId: newComment.id, guestId: guest.id };
    };

    // 회원
    async createChildComment(userId: string, dto: CreateChildCommentDto) {
        // I. user 찾기
        const user = await this.usersService.findUserById(userId);

        // I. parent comment 찾기
        const parentComment: ExtendedComment = await this.findComment({ id: dto.parentCommentId }, {
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
        if (parentComment.guest?.email) mailList.push(parentComment.guest.email); // 댓글 작성자가 회원이면 guest 존재하지 않으므로 처리
        parentComment.childComments.forEach(childComment => mailList.push(childComment.guest!.email));
        this.sendMail(mailList, { nickName: 'Jongdeug', postTitle: parentComment.post.title });

        return newChildComment.id;
    }

    async createChildCommentGuest(dto: CreateChildCommentGuestDto) {
        // I. parent comment 찾기
        const parentComment: ExtendedComment = await this.findComment({ id: dto.parentCommentId }, {
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

        // I. Transaction
        const { newChildComment, guest } = await database.$transaction(async (database) => {
            // I. guest 생성
            const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
            const guest = await this.usersService.createGuestForComment(dto.nickName, dto.email, hashedPwd);

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
        });

        // I. 메일 보내기 (블로그 주인, 부모 댓글 작성자(내가 작성한거면 메일 x), 자식 댓글 작성자들(내가 작성한거면 메일 x))
        let mailList = [process.env.MAIL_ID!];
        if (parentComment.guest?.email && parentComment.guest.email !== guest.email) mailList.push(parentComment.guest.email);
        parentComment.childComments.forEach(childComment => {
            if (childComment.guest!.email !== guest.email) mailList.push(childComment.guest!.email);
        });
        this.sendMail(mailList, { nickName: guest.nickName, postTitle: parentComment.post.title });

        return { newChildCommentId: newChildComment.id, guestId: guest.id, postId: parentComment.postId };
    }

    // ----

    async updateComment(userId: string, commentId: string, dto: UpdateCommentDto) {
        // I. user 검색
        const user = await this.usersService.findUserById(userId);
        // I. comment 검색
        const comment = await this.findComment({ id: commentId });

        // I. 권한 인증 (comment.authorId <=> user)
        if (comment.authorId !== user.id) throw new CustomError(403, 'Forbidden', '권한이 없습니다');

        // I. 댓글 수정
        await database.comment.update({
            where: { id: comment.id },
            data: { content: dto.content },
        });
    }

    async updateCommentGuest(commentId: string, dto: UpdateCommentGuestDto) {
        // I. comment 검색
        const comment: ExtendedComment = await this.findComment({ id: commentId, authorId: null }, { guest: true });

        // I. 비밀번호 권한 인증
        const isCorrect = await bcrypt.compare(dto.password, comment.guest!.password);
        if (!isCorrect) throw new CustomError(401, 'Unauthorized', '비밀번호를 잘못 입력하셨습니다');

        // I. 댓글 수정
        await database.comment.update({
            where: { id: comment.id },
            data: { content: dto.content },
        });
    }

    // ----

    async deleteComment() {

    }

    /**
     * [Utils]
     * sendMail : 댓글 알림 메일 보내는 함수
     * findComment : 댓글 검색 함수
     */
    sendMail(to: string[], payload: { nickName: string, postTitle: string }) {
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
                    <p><a href="jongdeug">바로가기</a>.</p>
                    </div>
                </div>
            `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    throw new CustomError(500, 'Internal Server Error', error.message);
                } else {
                    console.log('Email sent: ' + info.response);
                }
            });
        }
    }

    async findComment(whereOptions: Prisma.CommentWhereUniqueInput, includeOptions: Prisma.CommentInclude = {}) {
        const comment = await database.comment.findUnique({
            where: { ...whereOptions },
            include: { ...includeOptions },
        });

        if (!comment) throw new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다');

        return comment;
    }
}
