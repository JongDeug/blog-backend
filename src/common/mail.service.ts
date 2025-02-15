import { MailerService } from '@nestjs-modules/mailer';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './const/env.const';
import { GuestComment, Post, User } from '@prisma/client';
import { FoundParentComment } from 'src/prisma/type/comment.type';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class MailService {
  private subject: string;
  private templateFileName: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    this.subject = "[Jongdeug's 블로그 댓글 알림]";
    this.templateFileName = 'notification';
  }

  sendMailToPostAuthor(
    post: Post & { author: User },
    sender: User | GuestComment,
  ) {
    if (post.author.email !== sender.email) {
      this.mailerService
        .sendMail({
          to: post.author.email,
          subject: this.subject,
          template: this.templateFileName,
          context: {
            senderName: 'name' in sender ? sender.name : sender.nickName,
            link:
              process.env.NODE_ENV === 'production'
                ? `${this.configService.get(envVariableKeys.serverOrigin)}/blog/${post.id}`
                : `http://localhost:3000/blog/${post.id}`,

            title: post.title,
          },
        })
        .catch((reject) => this.logger.error(reject, null, MailService.name));
    }
  }

  sendMailToPostRelatedAuthors(
    parentComment: FoundParentComment,
    sender: User | GuestComment,
  ) {
    const set: Set<string> = new Set();

    // 게시글 작성자 vs 대댓글 작성자
    set.add(parentComment.post.author.email);
    // 댓글 작성자(guest, author) vs 대댓글 작성자
    if (parentComment.authorId) set.add(parentComment.author.email);
    if (parentComment.guestId) set.add(parentComment.guest.email);
    // 대댓글 작성자들(guest, author) vs 대댓글 작성자
    parentComment.childComments.forEach((comment) => {
      if (comment.authorId) set.add(comment.author.email);
      if (comment.guestId) set.add(comment.guest.email);
    });
    // 작성자 이메일 빼기
    set.delete(sender.email);

    if (!set.size) {
      this.mailerService
        .sendMail({
          to: [...set],
          subject: this.subject,
          template: this.templateFileName,
          context: {
            senderName: 'name' in sender ? sender.name : sender.nickName,
            link:
              process.env.NODE_ENV === 'production'
                ? `${this.configService.get(envVariableKeys.serverOrigin)}/blog/${parentComment.post.id}`
                : `http://localhost:3000/blog/${parentComment.post.id}`,
            title: parentComment.post.title,
          },
        })
        .catch((reject) => this.logger.error(reject, null, MailService.name));
    }
  }
}
