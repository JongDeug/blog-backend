import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { PostService } from '../post.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommentService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly postService: PostService,
    private readonly userService: UserService,
  ) {}

  async createComment(userId: number, createCommentDto: CreateCommentDto) {
    const foundUser = await this.userService.findUserWithNotFoundException(
      { id: userId },
      '유저를 찾을 수 없습니다',
    );

    const foundPost = await this.postService.findPostWithNotFoundException(
      { id: createCommentDto.postId },
      '게시글이 존재하지 않습니다',
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

    return newComment.id;
  }

  async createChildComment(userId: number, createCommentDto: CreateCommentDto) {
    const foundUser = await this.userService.findUserWithNotFoundException(
      { id: userId },
      '유저를 찾을 수 없습니다',
    );

    const foundParentComment = await this.findCommentWithNotFoundException(
      { id: createCommentDto.parentCommentId },
      '부모 댓글이 존재하지 않습니다',
    );

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
