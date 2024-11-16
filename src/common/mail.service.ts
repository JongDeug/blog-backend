import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './const/env.const';
import { Post, Prisma, User } from '@prisma/client';

export type SendMailInfo = {
  to: string | string[];
  receiverName: string;
  senderName: string;
  post: {
    id: number;
    title: string;
  };
};

@Injectable()
export class MailService {
  private subject: string;
  private templateFileName: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.subject = "[Jongdeug's 블로그 댓글 알림]";
    this.templateFileName = 'notification';
  }

  sendMailToPostAuthor(payload: SendMailInfo) {
    const { to, receiverName, senderName, post } = payload;

    this.mailerService.sendMail({
      to,
      subject: this.subject,
      template: this.templateFileName,
      context: {
        receiverName,
        senderName,
        link: `${this.configService.get(envVariableKeys.serverOrigin)}/post/${post.id}`,
        title: post.title,
      },
    });

    // 게시글 작성자와 댓글 작성자 비교
    // if (post.author.id !== user.id) {
    //   this.mailerService.sendMail({
    //     to: post.author.email,
    //     subject: this.subject,
    //     template: this.templateFileName,
    //     // 템플릿에 전달할 데이터
    //     context: {
    //       receiver: post.author.name,
    //       sender: user.name,
    //       link: `${this.configService.get(envVariableKeys.serverOrigin)}/post/${post.id}`,
    //       title: post.title,
    //     },
    //   });
    // }
  }

  sendMailToPostCommentChildCommentAuthors(sender: User, receiver: Comment) {
    // foundParentComment.post, // 게시글
    //       foundParentComment.author, // 댓글
    //       foundParentComment.childComments, // 대댓글 복수
    // 게시글 작성자 vs 대댓글 작성자
    // 댓글 작성자 vs 대댓글 작성자
    // 대댓글 작성자 vs 대댓글 작성자
  }
}
