import {
  BadRequestException,
  ForbiddenException,
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
import { MailService } from 'src/common/mail.service';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { AuthService } from 'src/auth/auth.service';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';

@Injectable()
export class CommentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postService: PostService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  async createComment(userId: number, createCommentDto: CreateCommentDto) {
    const { postId, content } = createCommentDto;

    const foundUser = await this.userService.findUserById(userId);

    const foundPost = await this.postService.findPostWithAuthor(postId);

    const newComment = await this.prismaService.comment.create({
      data: {
        content,
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

    // 이메일 알림
    this.mailService.sendMailToPostAuthor(foundPost, foundUser);

    return newComment.id;
  }

  async createChildComment(userId: number, createCommentDto: CreateCommentDto) {
    const { parentCommentId, content, postId } = createCommentDto;

    const foundUser = await this.userService.findUserById(userId);

    const foundParentComment =
      await this.findParentCommentWithAuthors(parentCommentId);

    if (postId !== foundParentComment.postId)
      throw new BadRequestException(
        'postId, parentCommentId가 유효한지 다시 확인해주세요',
      );

    const newChildComment = await this.prismaService.comment.create({
      data: {
        content,
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
    this.mailService.sendMailToPostRelatedAuthors(
      foundParentComment,
      foundUser,
    );

    return newChildComment.id;
  }

  async update(userId: number, id: number, updateCommentDto: UpdateCommentDto) {
    const foundUser = await this.userService.findUserById(userId);

    const foundComment = await this.findCommentById(id);

    // 댓글 작성자가 아니면서, 관리자가 아니면
    if (foundUser.id !== foundComment.authorId && foundUser.role !== 'ADMIN') {
      throw new ForbiddenException('댓글에 대한 권한이 없습니다');
    }

    await this.prismaService.comment.update({
      where: { id: foundComment.id },
      data: {
        content: updateCommentDto.content,
      },
    });

    return foundComment.id;
  }

  async remove(id: number, userId: number) {
    const foundUser = await this.userService.findUserById(userId);

    const foundComment = await this.findCommentById(id);

    if (foundUser.id !== foundComment.authorId && foundUser.role !== 'ADMIN') {
      throw new ForbiddenException('댓글에 대한 권한이 없습니다');
    }

    await this.prismaService.comment.delete({
      where: { id: foundComment.id },
    });

    // 관리자가 guest comment를 지웠을 경우 => 비회원 정보도 지운다
    if (!foundComment.authorId) {
      await this.prismaService.guestComment.delete({
        where: { id: foundComment.guestId },
      });
    }
  }

  async createCommentByGuest(
    guestId: string,
    createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { postId, content } = createCommentByGuestDto;

    const foundPost = await this.postService.findPostWithAuthor(postId);

    const { newComment, newGuestComment } =
      await this.prismaService.$transaction(async (database) => {
        const newGuestComment = await this.createGuestComment(
          database,
          guestId,
          createCommentByGuestDto,
        );

        const newComment = await database.comment.create({
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

        return { newComment, newGuestComment };
      });

    // 이메일 전송 시스템
    this.mailService.sendMailToPostAuthor(foundPost, newGuestComment);

    return newComment.id;
  }

  async createChildCommentByGuest(
    guestId: string,
    createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { parentCommentId, content, postId } = createCommentByGuestDto;

    const foundParentComment =
      await this.findParentCommentWithAuthors(parentCommentId);

    if (postId !== foundParentComment.postId)
      throw new BadRequestException(
        'postId, parentCommentId가 유효한지 다시 확인해주세요',
      );

    const { newChildComment, newGuestComment } =
      await this.prismaService.$transaction(async (database) => {
        const newGuestComment = await this.createGuestComment(
          database,
          guestId,
          createCommentByGuestDto,
        );

        const newChildComment = await database.comment.create({
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

        return { newChildComment, newGuestComment };
      });

    // 이메일 전송 시스템
    this.mailService.sendMailToPostRelatedAuthors(
      foundParentComment,
      newGuestComment,
    );

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
      where: { id: foundComment.id },
      data: { content },
    });
  }

  async removeCommentByGuest(
    id: number,
    guestId: string,
    deleteCommentByGuestDto: DeleteCommentByGuestDto,
  ) {
    const foundComment = await this.findCommentWithGuest(id);

    // 비밀번호 인증
    await this.authService.comparePassword(
      deleteCommentByGuestDto.password,
      foundComment.guest.password,
    );

    // guestId 추가 인증
    if (guestId !== foundComment.guest.guestId) {
      throw new UnauthorizedException('잘못된 인증 정보입니다');
    }

    await this.prismaService.comment.delete({
      where: {
        id: foundComment.id,
      },
    });

    await this.prismaService.guestComment.delete({
      where: { id: foundComment.guestId },
    });
  }

  async findCommentById(id: number) {
    const foundComment = await this.prismaService.comment.findUnique({
      where: { id },
    });
    if (!foundComment) throw new NotFoundException('댓글이 존재하지 않습니다');

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

  async findParentCommentWithAuthors(id: number) {
    const foundParentComment = await this.prismaService.comment.findUnique({
      where: { id },
      include: {
        post: { include: { author: true } },
        childComments: { include: { author: true, guest: true } },
        author: true,
        guest: true,
      },
    });
    if (!foundParentComment)
      throw new NotFoundException('부모 댓글이 존재하지 않습니다');

    return foundParentComment;
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
