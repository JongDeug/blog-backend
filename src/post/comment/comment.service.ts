import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PostService } from '../post.service';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService, SendMailInfo } from 'src/common/mail.service';

@Injectable()
export class CommentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mailService: MailService,
  ) {}

  async createComment(userId: number, createCommentDto: CreateCommentDto) {
    const foundUser = await this.userService.findUserWithNotFoundException(
      { id: userId },
      '유저를 찾을 수 없습니다',
    );

    const foundPost = await this.postService.findPostWithNotFoundException(
      { id: createCommentDto.postId },
      '게시글이 존재하지 않습니다',
      { author: true },
    );

    const newComment = await this.prismaService.comment.create({
      data: {
        content: createCommentDto.content,
        author: {
          connect: {
            id: foundUser.id,
          },
        },
        post: {
          connect: {
            id: foundPost.id,
          },
        },
      },
    });

    // 이메일 알림 서비스
    // 게시글 작성자 vs 댓글 작성자
    if (foundPost.author.id !== foundUser.id) {
      this.mailService.sendMailToPostAuthor({
        to: foundPost.author.email,
        receiverName: foundPost.author.name,
        senderName: foundUser.name,
        post: {
          title: foundPost.title,
          id: foundPost.id,
        },
      });
    }

    return newComment.id;
  }

  async createChildComment(userId: number, createCommentDto: CreateCommentDto) {
    const foundUser = await this.userService.findUserWithNotFoundException(
      { id: userId },
      '유저를 찾을 수 없습니다',
    );

    const foundParentComment = await this.prismaService.comment.findUnique({
      where: { id: createCommentDto.parentCommentId },
      include: {
        post: { include: { author: true } },
        childComments: { include: { author: true } },
        author: true,
        guest: true,
      },
    });
    if (!foundParentComment)
      throw new NotFoundException('부모 댓글이 존재하지 않습니다');
    // const foundParentComment = await this.findCommentWithNotFoundException(
    //   { id: createCommentDto.parentCommentId },
    //   '부모 댓글이 존재하지 않습니다',
    //   {post: {include: {author: true}}}
    // );

    const newChildComment = await this.prismaService.comment.create({
      data: {
        content: createCommentDto.content,
        parentComment: {
          connect: { id: foundParentComment.id },
        },
        post: {
          connect: { id: foundParentComment.postId },
        },
        author: {
          connect: { id: foundUser.id },
        },
      },
    });

    // 이메일 알림 서비스
    // 게시글 작성자 vs 대댓글 작성자
    // 댓글 작성자 vs 대댓글 작성자 // 댓글 작성부터는 guest, author 둘 다 가능하기 때문에 다 넣어봐야?
    // 대댓글 작성자 vs 대댓글 작성자
    // set에 다 모아서 빼면되는거 아닌가?
    const toSet = new Set();
    toSet.add(foundParentComment.post.author.email);
    toSet.add(foundParentComment?.author.email);
    toSet.add(foundParentComment?.guest.email);
    toSet.add(foundParentComment.childComments);

    // this.mailService.sendMailToPostCommentChildCommentAuthors(
    //   foundUser, // 전송하는 사람 정보
    //   foundParentComment, // 받는 사람 정보 + 관련 정보들
    // );
    // this.mailService.sendMailToPostAndCommentAuthor()
    //      // I. 메일 보내기(부모 댓글 작성자, 자식 댓글 작성자)
    //      let mailList: string[] = [];
    //      if (parentComment.guest?.email)
    //          mailList.push(parentComment.guest.email); // 댓글 작성자가 회원이면 guest 존재하지 않으므로 처리
    //      parentComment.childComments.forEach((childComment) =>
    //          mailList.push(childComment.guest!.email)
    //      );
    //      this.sendMail(mailList, {
    //          nickName: 'Jongdeug',
    //          postTitle: parentComment.post.title,
    //          postId: parentComment.postId,
    //      });

    return newChildComment.id;
  }

  update(id: number, updateCommentDto: UpdateCommentDto) {
    return `This action updates a #${id} comment`;
  }

  remove(id: number) {
    return `This action removes a #${id} comment`;
  }

  async findCommentWithNotFoundException(
    whereConditions: Prisma.CommentWhereUniqueInput,
    errorMessage: string,
    includeConditions: Prisma.CommentInclude = {},
  ) {
    const comment = await this.prismaService.comment.findUnique({
      where: whereConditions,
      include: includeConditions,
    });
    if (!comment) throw new NotFoundException(errorMessage);

    return comment;
  }
}
