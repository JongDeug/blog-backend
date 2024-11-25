import { PrismaService } from 'src/prisma/prisma.service';
import { CommentService } from './comment.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import {
  Post,
  Comment,
  User,
  Guest,
  GuestComment,
  Category,
} from '@prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { AuthService } from 'src/auth/auth.service';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';

describe('CommentService - Integration Test', () => {
  let app: INestApplication;
  let commentService: CommentService;
  let prismaService: PrismaService;
  let authService: AuthService;

  let users: User[];
  let guests: Guest[];
  let guestComments: GuestComment[];
  let category: Category;
  let post: Post;
  let commentsByUser: Comment[];
  let commentsByGuest: Comment[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    commentService = module.get<CommentService>(CommentService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);

    // SEEDING
    users = await Promise.all(
      [1, 2, 3].map((id) =>
        prismaService.user.create({
          data: {
            id,
            name: `test${id}`,
            email: `test${id}@gmail.com`,
            password: '1234',
            role: id === 3 ? 'ADMIN' : 'USER',
          },
        }),
      ),
    );

    guests = await Promise.all(
      [0, 1, 2, 3].map((idx) =>
        prismaService.guest.create({ data: { guestId: `guestId${idx}` } }),
      ),
    );

    guestComments = await Promise.all(
      [0, 1, 2, 3].map(async (idx) =>
        prismaService.guestComment.create({
          data: {
            nickName: `nick${idx}`,
            email: `guest${idx}@gmail.com`,
            password: await authService.hashPassword('1234'),
            guest: {
              connect: { id: guests[idx].id },
            },
          },
        }),
      ),
    );

    category = await ((name) => {
      return prismaService.category.create({
        data: { name },
      });
    })('category');

    post = await ((idx) => {
      return prismaService.post.create({
        data: {
          title: `title${idx}`,
          content: `content${idx}`,
          summary: `summary${idx}`,
          author: {
            connect: { id: users[0].id },
          },
          category: {
            connect: { name: category.name },
          },
          draft: false,
        },
      });
    })(1);

    commentsByUser = await Promise.all(
      [0, 1, 2].map((idx) =>
        prismaService.comment.create({
          data: {
            content: `comment content${idx}`,
            post: {
              connect: { id: post.id },
            },
            author: {
              connect: { id: users[0].id },
            },
          },
        }),
      ),
    );

    commentsByGuest = await Promise.all(
      [0, 1, 2, 3].map((idx) =>
        prismaService.comment.create({
          data: {
            content: `comment content${idx}`,
            post: {
              connect: { id: post.id },
            },
            // guestComments
            guest: {
              connect: { id: guestComments[idx].id },
            },
          },
        }),
      ),
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

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

    await app.close();
  });

  it('should be defined', () => {
    expect(commentService).toBeDefined();
  });

  // 이메일 알림(비동기) 때문에 a worker process has failed to exit gracefully 경고 뜸
  describe('createComment', () => {
    it('should create a comment by a user', async () => {
      const userId = users[0].id;
      const createCommentDto: CreateCommentDto = {
        postId: post.id,
        content: 'content',
      };

      const result = await commentService.createComment(
        userId,
        createCommentDto,
      );

      expect(result).toEqual(expect.any(Number));
    });
  });

  describe('createChildComment', () => {
    it('should create a child comment by a user', async () => {
      const userId = users[0].id;
      const createCommentDto: CreateCommentDto = {
        postId: post.id,
        parentCommentId: commentsByUser[0].id,
        content: 'content',
      };

      const result = await commentService.createChildComment(
        userId,
        createCommentDto,
      );

      expect(result).toEqual(expect.any(Number));
    });

    it('should throw a BadRequestException if postId does not match foundParentComment.postId', async () => {
      const userId = users[0].id;
      const createCommentDto: CreateCommentDto = {
        postId: 999,
        parentCommentId: commentsByUser[0].id,
        content: 'content',
      };

      await expect(
        commentService.createChildComment(userId, createCommentDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a comment by a user', async () => {
      const userId = users[0].id;
      const id = commentsByUser[0].id;
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
      const userId = users[2].id;
      const id = commentsByUser[0].id;
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
      const userId = users[1].id;
      const id = commentsByUser[0].id;
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
      const userId = users[0].id;
      const id = commentsByUser[0].id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should remove a comment written by a guest if the user is an admin', async () => {
      const userId = users[2].id;
      const id = commentsByGuest[2].id;

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      await expect(commentService.findCommentById(id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        prismaService.guestComment.findUnique({
          where: { id: commentsByGuest[2].guestId },
        }),
      ).resolves.toBeNull();
    });

    it('should throw a UnauthorizedException if the user does not have the permission to remove it', async () => {
      const userId = users[1].id;
      const id = commentsByUser[1].id;

      await expect(commentService.remove(id, userId)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('createCommentByGuest', () => {
    it('should create a comment by a guest', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: post.id,
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
        postId: post.id,
        parentCommentId: commentsByUser[1].id,
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
        parentCommentId: commentsByUser[1].id,
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
      const id = commentsByGuest[0].id;
      const guestId = guests[0].guestId;
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
      const id = commentsByGuest[0].id;
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
      const id = commentsByGuest[0].id;
      const guestId = guests[0].guestId;
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
          where: { id: commentsByGuest[0].guestId },
        }),
      ).resolves.toBeNull();
    });

    it('should throw an UnauthorizedException if the guest does not have the permission to delete it', async () => {
      const id = commentsByGuest[1].id;
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
      const id = commentsByUser[2].id;

      const result = await commentService.findCommentById(id);

      expect(result).toHaveProperty('content', commentsByUser[2].content);
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      await expect(commentService.findCommentById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findCommentWithGuest', () => {
    it('should return a comment with the guest field', async () => {
      const id = commentsByGuest[3].id;

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
      const id = commentsByUser[2].id;

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
