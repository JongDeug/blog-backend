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
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { AuthService } from 'src/auth/auth.service';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';

describe('CommentService - Integration Test', () => {
  let commentService: CommentService;
  let prismaService: PrismaService;
  let authService: AuthService;

  let seedPost: Post;
  let seedComment1: Comment;
  let seedComment2: Comment;
  let seedComment3: Comment;
  let seedGuestComment1: Comment;
  let seedGuestComment2: Comment;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    commentService = module.get<CommentService>(CommentService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);

    // SEEDING
    const user1 = await prismaService.user.create({
      data: {
        id: 1,
        name: 'integration1',
        email: 'integration1@gmail.com',
        password: '1234',
      },
    });

    await prismaService.user.create({
      data: {
        id: 2,
        name: 'integration2',
        email: 'integration2@gmail.com',
        password: '1234',
      },
    });

    await prismaService.user.create({
      data: {
        id: 3,
        name: 'integration3',
        email: 'integration3@gmail.com',
        password: '1234',
        role: 'ADMIN',
      },
    });

    const guestComment1 = await prismaService.guestComment.create({
      data: {
        nickName: 'nick1',
        email: 'guestEmail1@gmail.com',
        password: await authService.hashPassword('1234'),
        guest: {
          connectOrCreate: {
            where: { guestId: 'guestId1' },
            create: { guestId: 'guestId1' },
          },
        },
      },
    });

    const guestComment2 = await prismaService.guestComment.create({
      data: {
        nickName: 'nick2',
        email: 'guestEmail2@gmail.com',
        password: await authService.hashPassword('1234'),
        guest: {
          connectOrCreate: {
            where: { guestId: 'guestId2' },
            create: { guestId: 'guestId2' },
          },
        },
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

    seedGuestComment1 = await prismaService.comment.create({
      data: {
        content: 'guest comment content1',
        post: {
          connect: { id: seedPost.id },
        },
        guest: {
          connect: { id: guestComment1.id },
        },
      },
    });

    seedGuestComment2 = await prismaService.comment.create({
      data: {
        content: 'guest comment content2',
        post: {
          connect: { id: seedPost.id },
        },
        guest: {
          connect: { id: guestComment2.id },
        },
      },
    });
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();
    const deleteGuest = prismaService.guest.deleteMany();
    const deleteGuestComment = prismaService.guestComment.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();
    const deleteComments = prismaService.comment.deleteMany();
    const deletePosts = prismaService.post.deleteMany();

    await prismaService.$transaction([
      deleteComments,
      deleteGuestComment,
      deleteGuest,
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
      it('should create a comment by a user', async () => {
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
      it('should create a child comment by a user', async () => {
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
    it('should update a comment by a user', async () => {
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
      const id = seedComment2.id;
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
      const id = seedComment3.id;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updatedContent',
      };

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('remove', () => {
    it('should remove a comment by a user', async () => {
      const userId = 1;
      const id = seedComment1.id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove a comment if the user is an admin', async () => {
      const userId = 3;
      const id = seedComment2.id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a UnauthorizedException if the user does not have the permission to remove it', async () => {
      const userId = 2;
      const id = seedComment3.id;

      await expect(commentService.remove(id, userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('createCommentByGuest', () => {
    it('should create a comment by a guest', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: seedPost.id,
        nickName: 'nick',
        email: 'guest@gmail.com',
        password: '1234',
        content: 'content',
      };

      const result = await commentService.createCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );
      expect(result).toEqual(expect.any(Number));
    });
  });

  describe('createChildCommentByGuest', () => {
    it('should create a child comment by a guest', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: seedPost.id,
        parentCommentId: seedComment3.id,
        nickName: 'nick',
        email: 'guest@gmail.com',
        password: '1234',
        content: 'content',
      };

      const result = await commentService.createChildCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );
      expect(result).toEqual(expect.any(Number));
    });

    it('should throw a BadRequestException if postId does not match foundParentComment.postId', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 999,
        parentCommentId: seedComment3.id,
        nickName: 'nick',
        email: 'guest@gmail.com',
        password: '1234',
        content: 'content',
      };

      await expect(
        commentService.createChildCommentByGuest(
          guestId,
          createCommentByGuestDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCommentByGuest', () => {
    it('should update a comment by a guest', async () => {
      const id = seedGuestComment1.id;
      const guestId = 'guestId1';
      const updateCommentByGuestDto: UpdateCommentByGuestDto = {
        content: 'updatedContent',
        password: '1234',
      };

      await expect(
        commentService.updateCommentByGuest(
          id,
          guestId,
          updateCommentByGuestDto,
        ),
      ).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).resolves.toHaveProperty(
        'content',
        updateCommentByGuestDto.content,
      );
    });

    it('should throw an UnauthorizedException if the guest does not have the permission to update it', async () => {
      const id = seedGuestComment1.id;
      const guestId = 'otherGuest';
      const updateCommentByGuestDto: UpdateCommentByGuestDto = {
        content: 'updatedContent',
        password: '1234',
      };

      await expect(
        commentService.updateCommentByGuest(
          id,
          guestId,
          updateCommentByGuestDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('removeCommentByGuest', () => {
    it('should remove a comment by a guest', async () => {
      const id = seedGuestComment1.id;
      const guestId = 'guestId1';
      const deleteCommentByGuestDto: DeleteCommentByGuestDto = {
        password: '1234',
      };

      await expect(
        commentService.removeCommentByGuest(
          id,
          guestId,
          deleteCommentByGuestDto,
        ),
      ).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        prismaService.guestComment.findUnique({
          where: { id: seedGuestComment1.guestId },
        }),
      ).resolves.toBeNull();
    });

    it('should throw an UnauthorizedException if the guest does not have the permission to delete it', async () => {
      const id = seedGuestComment2.id;
      const guestId = 'otherGuest';
      const deleteCommentByGuestDto: DeleteCommentByGuestDto = {
        password: '1234',
      };

      await expect(
        commentService.removeCommentByGuest(
          id,
          guestId,
          deleteCommentByGuestDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findCommentById', () => {
    it('should return a comment', async () => {
      const id = seedComment3.id;
      const result = await commentService.findCommentById(id);
      expect(result).toHaveProperty('content', 'comment content3');
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      await expect(commentService.findCommentById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findCommentWithGuest', () => {
    it('should return a comment with the guest field', async () => {
      const id = seedGuestComment2.id;
      const result = await commentService.findCommentWithGuest(id);
      expect(result).toHaveProperty('guest');
      expect(result).not.toHaveProperty('author');
      expect(result.authorId).toBeNull();
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      await expect(commentService.findCommentWithGuest(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findParentCommentWithAuthors', () => {
    it('should return a parent comment with authors', async () => {
      const id = seedComment3.id;
      const result = await commentService.findParentCommentWithAuthors(id);
      expect(result).toHaveProperty('guest');
      expect(result).toHaveProperty('author');
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      await expect(
        commentService.findParentCommentWithAuthors(999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // createGuestComment 제외, 이미 테스트 완료
});
