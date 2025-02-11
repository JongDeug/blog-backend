import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Category, Post, Role, User } from '@prisma/client';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import { PostService } from './post.service';

describe('PostController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let users: User[];
  let category: Category;
  let posts: Post[];
  let token: string;

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
    const postService = moduleFixture.get<PostService>(PostService);

    users = await Promise.all(
      [0, 1].map((idx) =>
        prismaService.user.create({
          data: {
            name: `test${idx}`,
            email: `test${idx}@gmail.com`,
            password: '1234',
            role: Role.ADMIN,
          },
        }),
      ),
    );

    category = await prismaService.category.create({
      data: { name: 'category' },
    });

    posts = await Promise.all(
      [0, 1, 2, 3].map((idx) =>
        prismaService.post.create({
          data: {
            title: `title${idx}`,
            content: `content${idx}`,
            summary: `summary${idx}`,
            author: {
              connect: idx === 1 ? { id: users[1].id } : { id: users[0].id },
            },
            category: {
              connect: { id: category.id },
            },
            draft: false,
            images:
              idx === 2
                ? {
                    createMany: {
                      data: [
                        {
                          url: new URL(
                            'seedImage',
                            postService.getBaseURL(),
                          ).toString(),
                        },
                      ],
                    },
                  }
                : {},
          },
        }),
      ),
    );

    const authService = moduleFixture.get<AuthService>(AuthService);
    token = await authService.issueToken(
      { id: users[0].id, role: users[0].role },
      false,
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteImages = prismaService.image.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteImages,
      deleteUsers,
      deleteCategory,
    ]);
    await prismaService.$disconnect();

    await app.close();
  });

  describe('[POST] /post', () => {
    it('should create a post', async () => {
      const dto = {
        title: 'post title',
        content: 'post content',
        draft: false,
        summary: 'post summary',
        category,
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .post('/post')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(201);
      expect(body).toBeDefined();
    });

    it('should return 403 when the token is invalid', async () => {
      const dto = {
        title: 'post title',
        content: 'post content',
        draft: false,
        summary: 'post summary',
        category,
      };

      const { statusCode } = await request(app.getHttpServer())
        .post('/post')
        .set('Authorization', 'Bearer adslfkjsdflksdjfsldkfjlkf')
        .send(dto);

      expect(statusCode).toBe(403);
    });

    it('should return 404 when the image does not exist', async () => {
      const dto = {
        title: 'post title 2',
        content: 'post content 2',
        draft: false,
        summary: 'post summary 2',
        category,
        images: ['abcd', 'bcd'],
      };

      const { statusCode } = await request(app.getHttpServer())
        .post('/post')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(404);
    });
  });

  describe('[GET] /post', () => {
    it('should get all posts', async () => {
      const query = {
        take: '3',
        search: 'title',
        draft: 'false',
        'order[]': 'id_asc',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .get('/post')
        .query(query);

      expect(statusCode).toBe(200);
      expect(body.posts).toHaveLength(parseInt(query.take));
      expect(body.cursor).toBeDefined();
    });

    it('should return 400 when the query is invalid', async () => {
      const query = {
        take: '3',
        search: 'title',
        draft: 'false',
        'order[]': 'id_wowowowowowow',
      };

      const { statusCode } = await request(app.getHttpServer())
        .get('/post')
        .query(query);

      expect(statusCode).toBe(400);
    });
  });

  describe('[GET] /post/:id', () => {
    it('should get a post', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .get(`/post/${posts[0].id}`)
        .set('Cookie', [`guestId=uuid`]);

      expect(statusCode).toBe(200);
      expect(body.title).toBe(posts[0].title);
      expect(body.content).toBe(posts[0].content);
      expect(body.isLiked).toBe(false);
    });

    it('should return 400 when there is no guestId in cookies', async () => {
      const { body, statusCode } = await request(app.getHttpServer()).get(
        `/post/${posts[0].id}`,
      );

      expect(statusCode).toBe(400);
      expect(body.message).toBe('쿠키에 guestId 정보가 없습니다');
    });

    it('should return 404 if the post does not exist', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .get(`/post/${9999}`)
        .set('Cookie', [`guestId=uuid`]);

      expect(statusCode).toBe(404);
    });
  });

  describe('[PATCH] /post/:id', () => {
    it('should update a post', async () => {
      const dto = {
        title: 'updated title',
        content: 'updated content',
        draft: true,
        summary: 'updated summary',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/post/${posts[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404 when the post does not exist', async () => {
      const dto = {
        title: 'updated title',
        content: 'updated content',
        draft: true,
        summary: 'updated summary',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/${9999}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 404 when the image does not exist', async () => {
      const dto = {
        title: 'updated title',
        content: 'updated content',
        draft: true,
        summary: 'updated summary',
        images: ['wsldkfjdslfkdsjoooooo'],
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/${posts[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 403 when the user does not have the permission to update the post', async () => {
      const dto = {
        title: 'updated title',
        content: 'updated content',
        draft: true,
        summary: 'updated summary',
      };

      const { statusCode } = await request(app.getHttpServer())
        .patch(`/post/${posts[1].id}`) // 다른 유저가 작성함
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(403);
    });
  });

  describe('[DELETE] /post/:id', () => {
    it('should delete a post', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .delete(`/post/${posts[3].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404 when the post does not exist', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .delete(`/post/${9999}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(404);
    });

    it('should return 403 when the user does not have the permission to delete the post', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .delete(`/post/${posts[1].id}`) // 다른 유저가 작성함
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(403);
    });

    it('should return 404 when the image does not exist', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .delete(`/post/${posts[2].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(404);
    });
  });
});
