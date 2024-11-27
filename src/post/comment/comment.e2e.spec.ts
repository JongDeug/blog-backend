import {
  INestApplication,
  ValidationPipe,
  ArgumentsHost,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Category,
  Guest,
  GuestComment,
  Post,
  Comment,
  Role,
  User,
} from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';

describe('CommentController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let users: User[];
  let guests: Guest[];
  let guestComments: GuestComment[];
  let category: Category;
  let post: Post;
  let commentsByUser: Comment[];
  let commentsByGuest: Comment[];
  let tokens: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.use(cookieParser());
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    let authService = moduleFixture.get<AuthService>(AuthService);

    users = await Promise.all(
      [0, 1, 2].map((idx) =>
        prismaService.user.create({
          data: {
            name: `test${idx}`,
            email: `test${idx}@gmail.com`,
            password: '1234',
            role: idx === 2 ? Role.ADMIN : Role.USER,
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

    category = await prismaService.category.create({
      data: { name: 'category' },
    });

    post = await prismaService.post.create({
      data: {
        title: 'title1',
        content: 'content1',
        summary: 'summary1',
        author: {
          connect: { id: users[0].id },
        },
        category: {
          connect: { name: category.name },
        },
        draft: false,
      },
    });

    commentsByUser = await Promise.all(
      [0, 1, 2].map((idx) =>
        prismaService.comment.create({
          data: {
            content: `comment content${idx}`,
            post: {
              connect: { id: post.id },
            },
            author: {
              connect: idx === 1 ? { id: users[1].id } : { id: users[0].id },
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

    tokens = await Promise.all(
      [0, 1].map((idx) =>
        authService.issueToken({ id: users[0].id, role: users[0].role }, false),
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

  describe('[POST] /post/comment/user', () => {
    describe('create a comment', () => {
      it('should allow a user to create a comment', async () => {
        const dto = {
          postId: post.id,
          content: 'user comment content',
        };

        const { body, statusCode } = await request(app.getHttpServer())
          .post('/post/comment/user')
          .set('Cookie', [`accessToken=${tokens[0]}`])
          .send(dto);

        expect(statusCode).toBe(201);
        expect(body).toBeDefined();
      });

      it('should return 404', async () => {
        const dto = {
          postId: 9999,
          content: 'user comment content',
        };

        const { statusCode } = await request(app.getHttpServer())
          .post('/post/comment/user')
          .set('Cookie', [`accessToken=${tokens[0]}`])
          .send(dto);

        expect(statusCode).toBe(404);
      });
    });

    describe('create a child comment', () => {
      it('should allow a user to create a child comment', async () => {
        const dto = {
          postId: post.id,
          parentCommentId: commentsByUser[0].id,
          content: 'user child comment content',
        };

        const { body, statusCode } = await request(app.getHttpServer())
          .post('/post/comment/user')
          .set('Cookie', [`accessToken=${tokens[0]}`])
          .send(dto);

        expect(statusCode).toBe(201);
        expect(body).toBeDefined();
      });

      it('should return 404', async () => {
        const dto = {
          postId: 9999,
          parentCommentId: 9999,
          content: 'user child comment content',
        };

        const { statusCode } = await request(app.getHttpServer())
          .post('/post/comment/user')
          .set('Cookie', [`accessToken=${tokens[0]}`])
          .send(dto);

        expect(statusCode).toBe(404);
      });

      it("should return 400 if postId does not match the parent comment's postId", async () => {
        const dto = {
          postId: 9999,
          parentCommentId: commentsByUser[0].id,
          content: 'user child comment content',
        };

        const { statusCode } = await request(app.getHttpServer())
          .post('/post/comment/user')
          .set('Cookie', [`accessToken=${tokens[0]}`])
          .send(dto);

        expect(statusCode).toBe(400);
      });
    });
  });

  describe('[PATCH] /post/comment/user/:id', () => {
    it('should allow a user to update a comment', async () => {
      const dto = {
        content: 'updated content',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/user/${commentsByUser[0].id}`)
        .set('Cookie', [`accessToken=${tokens[0]}`])
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should allow an admin to update a comment', async () => {
      const dto = {
        content: 'updated content',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/user/${commentsByUser[0].id}`)
        .set('Cookie', [`accessToken=${tokens[1]}`])
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const dto = {
        content: 'updated content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/user/${9999}`)
        .set('Cookie', [`accessToken=${tokens[0]}`])
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 401 when the user does not have the permission to update the comment', async () => {
      const dto = {
        content: 'updated content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/user/${commentsByUser[1].id}`)
        .set('Cookie', [`accessToken=${tokens[0]}`])
        .send(dto);

      expect(statusCode).toBe(401);
    });
  });

  describe('[DELETE] /post/comment/user/:id', () => {
    it('should allow a user to delete a comment', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/user/${commentsByUser[0].id}`)
        .set('Cookie', [`accessToken=${tokens[0]}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should allow an admin to delete a comment', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/user/${commentsByUser[2].id}`)
        .set('Cookie', [`accessToken=${tokens[1]}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/user/${9999}`)
        .set('Cookie', [`accessToken=${tokens[0]}`]);

      expect(statusCode).toBe(404);
    });

    it('should return 401 when the user does not have the permission to delete the comment', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/user/${commentsByUser[1].id}`)
        .set('Cookie', [`accessToken=${tokens[0]}`]);

      expect(statusCode).toBe(401);
    });
  });

  describe('[POST] /post/comment/guest', () => {
    describe('create a comment', () => {
      it('should allow a guest to create a comment', async () => {
        const dto = {
          postId: post.id,
          nickName: 'nick',
          email: 'nick@gmail.com',
          password: '1234',
          content: 'guest comment content',
        };

        const { body, statusCode } = await request(app.getHttpServer())
          .post('/post/comment/guest')
          .set('Cookie', ['guestId=uuid'])
          .send(dto);

        expect(statusCode).toBe(201);
        expect(body).toBeDefined();
      });
    });

    it('should return 404 when the post does not exist', async () => {
      const dto = {
        postId: 9999,
        nickName: 'nick',
        email: 'nick@gmail.com',
        password: '1234',
        content: 'guest comment content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .post('/post/comment/guest')
        .set('Cookie', ['guestId=uuid'])
        .send(dto);

      expect(statusCode).toBe(404);
    });

    describe('create a child comment', () => {
      it('should allow a guest to create a child comment', async () => {
        const dto = {
          postId: post.id,
          parentCommentId: commentsByGuest[0].id,
          nickName: 'nick',
          email: 'nick@gmail.com',
          password: '1234',
          content: 'guest child comment content',
        };

        const { body, statusCode } = await request(app.getHttpServer())
          .post('/post/comment/guest')
          .set('Cookie', ['guestId=uuid'])
          .send(dto);

        expect(statusCode).toBe(201);
        expect(body).toBeDefined();
      });

      it('should return 404 when the parent comment does not exist', async () => {
        const dto = {
          postId: post.id,
          parentCommentId: 9999,
          nickName: 'nick',
          email: 'nick@gmail.com',
          password: '1234',
          content: 'guest child comment content',
        };

        const { statusCode } = await request(app.getHttpServer())
          .post('/post/comment/guest')
          .set('Cookie', ['guestId=uuid'])
          .send(dto);

        expect(statusCode).toBe(404);
      });

      it("should return 400 if the postId does not match the parent comment's postId", async () => {
        const dto = {
          postId: 9999,
          parentCommentId: commentsByGuest[0].id,
          nickName: 'nick',
          email: 'nick@gmail.com',
          password: '1234',
          content: 'guest child comment content',
        };

        const { statusCode } = await request(app.getHttpServer())
          .post('/post/comment/guest')
          .set('Cookie', ['guestId=uuid'])
          .send(dto);

        expect(statusCode).toBe(400);
      });
    });
  });

  describe('[PATCH] /post/comment/guest/:id', () => {
    it('should allow a guest to update a comment', async () => {
      const dto = {
        password: '1234',
        content: 'updated content',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/guest/${commentsByGuest[0].id}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404 when the comment does not exist', async () => {
      const dto = {
        password: '1234',
        content: 'updated content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/guest/${9999}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 401 if the password does not match', async () => {
      const dto = {
        password: '54321',
        content: 'updated content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/guest/${commentsByGuest[0].id}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(401);
    });

    it('should return 401 if the guestId does not match', async () => {
      const dto = {
        password: '1234',
        content: 'updated content',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/comment/guest/${commentsByGuest[0].id}`)
        .set('Cookie', [`guestId=lsakdjfsldkfjdsflkdsfjsdlkfjslkfjdflfkj`])
        .send(dto);

      expect(statusCode).toBe(401);
    });
  });

  describe('[DELETE] /post/comment/guest/:id', () => {
    it('should allow a guest to delete a comment', async () => {
      const dto = {
        password: '1234',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/guest/${commentsByGuest[0].id}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404 when the comment does not exist', async () => {
      const dto = {
        password: '1234',
      };

      const { statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/guest/${9999}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 401 if the password does not match', async () => {
      const dto = {
        password: '54321',
      };

      const { statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/guest/${commentsByGuest[1].id}`)
        .set('Cookie', [`guestId=${guests[0].guestId}`])
        .send(dto);

      expect(statusCode).toBe(401);
    });

    it('should return 401 if the guestId does not match', async () => {
      const dto = {
        password: '1234',
      };

      const { statusCode } = await request(app.getHttpServer())
        .del(`/post/comment/guest/${commentsByGuest[1].id}`)
        .set('Cookie', [`guestId=lsakdjfsldkfjdsflkdsfjsdlkfjslkfjdflfkj`])
        .send(dto);

      expect(statusCode).toBe(401);
    });
  });
});
