import { CreateChildCommentDto, CreateCommentDto, CreateCommentGuestDto } from './dto';
import { UsersService } from '../../users/users.service';
import { PostsService } from '../posts.service';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import transporter from '@utils/nodemailer';
import { CustomError } from '@utils/customError';
import { GuestComment, Prisma, Comment } from '@prisma';

interface ExtendedComment extends Comment {
    childComments: (Comment & { guest?: GuestComment })[];
}

export class CommentsService {

    constructor(private readonly usersService: UsersService, private readonly postsService: PostsService) {
    }

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

        // I. 단발성으로 구현, nickname, email, password 가 같더라도 생성. guest 하나당 댓글 하나임.
        const { newComment, guest } = await database.$transaction(async (database) => {
            // I. guest 생성
            const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
            const guest = await this.usersService.createGuestComment(dto.nickName, dto.email, hashedPwd);

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

        // I. 트랜잭션이 성공하면 이메일 보내기
        this.sendMail(guest.email, process.env.MAIL_ID);

        return { newCommentId: newComment.id, guestId: guest.id };
    };

    async createChildComment(userId: string, dto: CreateChildCommentDto) {
        // I. user 찾기
        const user = await this.usersService.findUserById(userId);

        // I. parent comment 찾기
        const parentComment: ExtendedComment = await this.findCommentById(dto.parentCommentId, {
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

        // I. 메일 보내기
        parentComment.childComments.forEach(childComment => {
            this.sendMail(process.env.MAIL_ID, childComment.guest?.email);
        });

        return newChildComment.id;
    }

    /**
     * sendMail : 댓글 알림 메일 보내는 함수
     * findCommentById : 댓글 검색 함수
     */
    sendMail(from: string | undefined, to: string | undefined) {
        if (!from || !to) throw new CustomError(500, 'Internal Server Error', '이메일 from 또는 to 가 입력되지 않음');

        const mailOptions = {
            from, // 발신자 이메일 주소
            to, // 수신자 이메일 주소
            subject: '블로그 댓글 알림 메일',
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">Jongdeug's Blog</h2>
                    <p>Jongdueg 블로그에 댓글이 달렸습니다.</p>
                    <p><a href="jongdeug">바로가기</a>.</p>
                    </div>
                </div>
            `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }

    async findCommentById(commentId: string, includeOptions: Prisma.CommentInclude) {
        const comment = await database.comment.findUnique({
            where: { id: commentId },
            include: { ...includeOptions },
        });

        if (!comment) throw new CustomError(404, 'Not Found', '댓글을 찾을 수 없습니다');

        return comment;
    }
}
