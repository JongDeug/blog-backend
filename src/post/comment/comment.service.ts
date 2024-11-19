import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PostService } from '../post.service';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from 'src/common/mail.service';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest';
import { AuthService } from 'src/auth/auth.service';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest';

@Injectable()
export class CommentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mailService: MailService,
  ) {}

  async createComment(userId: number, createCommentDto: CreateCommentDto) {
    const foundUser = await this.userService.findUserById(userId);

    const foundPost = await this.postService.findPostWithAuthor(
      createCommentDto.postId,
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
    const foundUser = await this.userService.findUserById(userId);

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
    // const toSet = new Set();
    // toSet.add(foundParentComment.post.author.email);
    // toSet.add(foundParentComment?.author.email);
    // toSet.add(foundParentComment?.guest.email);
    // toSet.add(foundParentComment.childComments);

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

  async update(userId: number, id: number, updateCommentDto: UpdateCommentDto) {
    const foundUser = await this.userService.findUserById(userId);

    const foundComment = await this.findCommentById(id, false);

    // 댓글 작성자가 아니면서, 관리자가 아니면
    if (foundUser.id !== foundComment.authorId && foundUser.role !== 'ADMIN') {
      throw new UnauthorizedException('댓글에 대한 권한이 없습니다');
    }

    await this.prismaService.comment.update({
      where: { id: foundComment.id },
      data: {
        content: updateCommentDto.content,
      },
    });
  }

  async remove(id: number, userId: number) {
    const foundUser = await this.userService.findUserById(userId);

    const foundComment = await this.findCommentById(id, false);

    if (foundUser.id !== foundComment.authorId && foundUser.role !== 'ADMIN') {
      throw new UnauthorizedException('댓글에 대한 권한이 없습니다');
    }

    await this.prismaService.comment.delete({
      where: { id: foundComment.id },
    });
  }

  async createCommentByGuest(
    guestId: string,
    createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { postId, content } = createCommentByGuestDto;

    const foundPost = await this.postService.findPostById(postId);

    const newComment = await this.prismaService.$transaction(
      async (database) => {
        const newGuestComment = await this.createGuestComment(
          database,
          guestId,
          createCommentByGuestDto,
        );

        return database.comment.create({
          data: {
            content,
            // GuestComment
            guest: {
              connect: { id: newGuestComment.id },
            },
            post: {
              connect: { id: foundPost.id },
            },
          },
        });
      },
    );

    // 이메일 전송 시스템

    return newComment.id;
  }

  async createChildCommentByGuest(
    guestId: string,
    createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { parentCommentId, content } = createCommentByGuestDto;

    const foundParentComment = await this.findCommentById(
      parentCommentId,
      true,
    );

    const newChildComment = await this.prismaService.$transaction(
      async (database) => {
        const newGuestComment = await this.createGuestComment(
          database,
          guestId,
          createCommentByGuestDto,
        );

        return database.comment.create({
          data: {
            content,
            // GuestComment
            guest: {
              connect: { id: newGuestComment.id },
            },
            post: {
              connect: { id: foundParentComment.postId },
            },
            parentComment: {
              connect: { id: foundParentComment.id },
            },
          },
        });
      },
    );

    // 이메일 전송 시스템

    return newChildComment.id;
  }

  async updateCommentByGuest(
    id: number,
    guestId: string,
    updateCommentByGuestDto: UpdateCommentByGuestDto,
  ) {
    const { password, content } = updateCommentByGuestDto;

    const foundComment = await this.findCommentWithGuest(id);

    // 비밀번호 인증
    await this.authService.comparePassword(
      password,
      foundComment.guest.password,
    );

    // guestId 추가 인증
    if (guestId !== foundComment.guest.guestId) {
      throw new UnauthorizedException('잘못된 인증 정보입니다');
    }

    await this.prismaService.comment.update({
      where: { id },
      data: { content },
    });
  }

  // async removeCommentByGuest(
  //   id: number,
  //   guestId: string,
  //   deleteCommentByGuestDto: DeleteCommentByGuestDto,
  // ) {
  //   const foundComment = await this.findCommentWithGuest(id);

  //   // 비밀번호 인증
  //   await this.authService.comparePassword(
  //     deleteCommentByGuestDto.password,
  //     foundComment.guest.password,
  //   );

  //   // guestId 추가 인증
  //   if (guestId !== foundComment.guest.guestId) {
  //     throw new UnauthorizedException('잘못된 인증 정보입니다');
  //   }

  //   await this.prismaService.comment.delete({
  //     where: {
  //       id: foundComment.id,
  //     },
  //   });
  // }

  async findCommentById(id: number, isParent: boolean) {
    const foundComment = await this.prismaService.comment.findUnique({
      where: { id },
    });
    if (!foundComment)
      throw new NotFoundException(
        `${isParent ? '부모 ' : ''}댓글이 존재하지 않습니다`,
      );

    return foundComment;
  }

  async findCommentWithGuest(id: number) {
    const foundComment = await this.prismaService.comment.findUnique({
      where: { id, authorId: null },
      include: { guest: true },
    });
    if (!foundComment)
      throw new NotFoundException(
        '댓글이 존재하지 않거나 권한이 없는 댓글입니다',
      );

    return foundComment;
  }

  async createGuestComment(
    database: Prisma.TransactionClient,
    guestId: string,
    createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { nickName, password, email } = createCommentByGuestDto;

    // 비밀번호 암호화
    const hashedPassword = await this.authService.hashPassword(password);

    return database.guestComment.create({
      data: {
        nickName,
        email,
        password: hashedPassword,
        // (Guest <=> GuestComment): 일 대 다 관계임
        // Guest가 있으면 연결하고, 없을 때 생성함.
        guest: {
          connectOrCreate: {
            where: { guestId },
            create: { guestId },
          },
        },
      },
    });
  }
}
