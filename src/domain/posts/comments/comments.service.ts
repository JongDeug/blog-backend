import { CreateCommentDto, CreateCommentGuestDto } from './dto';
import { UsersService } from '../../users/users.service';
import { PostsService } from '../posts.service';
import database from '@utils/database';
import bcrypt from 'bcrypt';
import transporter from '@utils/nodemailer';
import * as process from 'node:process';

export class CommentsService {

    constructor(private readonly usersService: UsersService, private readonly postsService: PostsService) {
    }

    createComment = async (userId: string, dto: CreateCommentDto) => {
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

    createCommentGuest = async (dto: CreateCommentGuestDto) => {
        // I. guest 생성
        const hashedPwd = await bcrypt.hash(dto.password, Number(process.env.PASSWORD_SALT));
        const guest = await database.guestComment.create({
            data: {
                nickName: dto.nickname,
                email: dto.email,
                password: hashedPwd,
            },
        });

        // I. post 확인
        const post = await this.postsService.findPostById(dto.postId);

        // I. 단발성으로 구현 => nickname, email, password 가 같더라도 그냥 생성
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
                        id: dto.postId,
                    },
                },
            },
        });

        // I. 이메일 보내기
        const mailOptions = {
            from: `${guest.email}`, // 발신자 이메일 주소
            to: process.env.MAIL_ID, // 수신자 이메일 주소
            subject: '블로그 댓글 알림 메일', // 이메일 제목
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #4CAF50;">Jongdeug's Blog</h2>
                    <p>블로그에 댓글이 달렸습니다.</p>
                    <p><a href="jongdeug">바로가기</a>.</p>
                    </div>
                </div>
            `, // 이메일 본문
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        return { newCommentId: newComment.id, guestId: guest.id };
    };
}
