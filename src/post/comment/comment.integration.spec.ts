import { PrismaService } from 'src/prisma/prisma.service';
import { CommentService } from './comment.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { Post, Comment } from '@prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentService - Integration Test', () => {
  let commentService: CommentService;
  let prismaService: PrismaService;

  let seedPost: Post;
  let seedComment1: Comment;
  let seedComment2: Comment;
  let seedComment3: Comment;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    commentService = module.get<CommentService>(CommentService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    const user1 = await prismaService.user.create({
      data: {
        id: 1,
        name: 'integration1',
        email: 'integration1@gmail.com',
        password: '1234',
      },
    });

    const user2 = await prismaService.user.create({
      data: {
        id: 2,
        name: 'integration2',
        email: 'integration2@gmail.com',
        password: '1234',
      },
    });

    const user3 = await prismaService.user.create({
      data: {
        id: 3,
        name: 'integration3',
        email: 'integration3@gmail.com',
        password: '1234',
        role: 'ADMIN',
      },
    });

    const category = await prismaService.category.create({
      data: { name: 'category1' },
    });

    seedPost = await prismaService.post.create({
      data: {
        title: 'title1',
        content: 'content1',
        summary: 'summary1',
        author: {
          connect: { id: user1.id },
        },
        category: {
          connect: { id: category.id },
        },
        draft: false,
      },
    });

    seedComment1 = await prismaService.comment.create({
      data: {
        content: 'comment content1',
        post: {
          connect: { id: seedPost.id },
        },
        author: {
          connect: { id: user1.id },
        },
      },
    });

    seedComment2 = await prismaService.comment.create({
      data: {
        content: 'comment content2',
        post: {
          connect: { id: seedPost.id },
        },
        author: {
          connect: { id: user1.id },
        },
      },
    });

    seedComment3 = await prismaService.comment.create({
      data: {
        content: 'comment content3',
        post: {
          connect: { id: seedPost.id },
        },
        author: {
          connect: { id: user1.id },
        },
      },
    });
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();
    const deleteComments = prismaService.comment.deleteMany();
    const deletePosts = prismaService.post.deleteMany();

    await prismaService.$transaction([
      deleteComments,
      deletePosts,
      deleteUsers,
      deleteCategory,
    ]);

    await prismaService.$disconnect();
  });

  it('should be defined', () => {
    expect(commentService).toBeDefined();
  });

  describe('create', () => {
    let parentCommentId: number;

    // 이메일 알림(비동기) 때문에 a worker process has failed to exit gracefully 경고 뜸
    describe('createComment', () => {
      it('should create a comment and return its id', async () => {
        const userId = 2;
        const createCommentDto: CreateCommentDto = {
          postId: seedPost.id,
          content: 'content',
        };

        const result = await commentService.createComment(
          userId,
          createCommentDto,
        );
        expect(result).toEqual(expect.any(Number));
        parentCommentId = result;
      });
    });

    describe('createChildComment', () => {
      it('should create a child comment and return its id', async () => {
        const userId = 2;
        const createCommentDto: CreateCommentDto = {
          postId: seedPost.id,
          parentCommentId,
          content: 'content',
        };

        const result = await commentService.createChildComment(
          userId,
          createCommentDto,
        );
        expect(result).toEqual(expect.any(Number));
      });

      it('should throw a BadRequestException if postId does not match foundParentComment.postId', async () => {
        const userId = 2;
        const createCommentDto: CreateCommentDto = {
          postId: 999,
          parentCommentId,
          content: 'content',
        };

        await expect(
          commentService.createChildComment(userId, createCommentDto),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('update', () => {
    it('should update a comment', async () => {
      const userId = 1;
      const id = seedComment1.id;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updatedContent',
      };

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).resolves.toHaveProperty(
        'content',
        updateCommentDto.content,
      );
    });

    it('should update a comment if the user is an admin', async () => {
      const userId = 3;
      const id = seedComment3.id;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updatedContent',
      };

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).resolves.toHaveProperty(
        'content',
        updateCommentDto.content,
      );
    });

    it('should throw a UnauthorizedException if the user does not have the permission to update it', async () => {
      const userId = 2;
      const id = seedComment2.id;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updatedContent',
      };

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('remove', () => {
    it('should remove a comment', async () => {
      const userId = 1;
      const id = seedComment1.id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove a comment if the user is an admin', async () => {
      const userId = 3;
      const id = seedComment3.id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a UnauthorizedException if the user does not have the permission to remove it', async () => {
      const userId = 2;
      const id = seedComment2.id;

      await expect(commentService.remove(id, userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('createCommentByGuest', () => {
    it('should create');
  });
});
