import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import cookieParser from 'cookie-parser';
import { PrismaService } from 'src/prisma/prisma.service';
import { Category, Role, User } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';

describe('CategoryController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let categories: Category[];
  let user: User;
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

    categories = await Promise.all(
      [0, 1, 2].map((idx) =>
        prismaService.category.create({
          data: { name: `category${idx}` },
        }),
      ),
    );

    user = await prismaService.user.create({
      data: {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
        role: Role.ADMIN,
      },
    });

    // post
    await prismaService.post.create({
      data: {
        title: 'title1',
        content: 'content1',
        summary: 'summary1',
        draft: false,
        author: {
          connect: { id: user.id },
        },
        category: {
          connect: { name: categories[0].name },
        },
      },
    });

    const authService = moduleFixture.get<AuthService>(AuthService);
    token = await authService.issueToken(
      { id: user.id, role: user.role, email: user.email },
      false,
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteCategories = prismaService.category.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteCategories,
      deleteUsers,
    ]);
    await prismaService.$disconnect();
    await app.close();
  });

  describe('[POST] /category', () => {
    it('should create a category', async () => {
      const dto = {
        name: '후훗',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(201);
      expect(body.name).toBe(dto.name);
    });

    it('should return 409', async () => {
      const dto = {
        name: categories[0].name,
      };

      const { statusCode } = await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(409);
    });
  });

  describe('[GET] /category', () => {
    it('should get all categories', async () => {
      const { body, statusCode } = await request(app.getHttpServer()).get(
        '/category',
      );

      expect(statusCode).toBe(200);
      expect(body[0].name).toEqual(categories[0].name);
      expect(body[1].name).toEqual(categories[1].name);
      expect(body[0]).toHaveProperty('_count');
      expect(body).toHaveLength(categories.length + 1);
    });
  });

  describe('[GET] /category/:id', () => {
    it('should get a category', async () => {
      const { body, statusCode } = await request(app.getHttpServer()).get(
        `/category/${categories[0].id}`,
      );

      expect(statusCode).toBe(200);
      expect(body.name).toBe(categories[0].name);
      expect(body.posts).toHaveLength(1);
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer()).get(
        `/category/${9999}`,
      );

      expect(statusCode).toBe(404);
    });
  });

  describe('[PATCH] /category/:id', () => {
    it('should update a post', async () => {
      const dto = {
        name: 'updated category name',
      };
      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/category/${categories[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toEqual({});
    });

    it('should return 404', async () => {
      const dto = {
        name: 'updated category name',
      };
      const { statusCode } = await request(app.getHttpServer())
        .patch(`/category/${9999}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 409', async () => {
      const dto = {
        name: categories[1].name,
      };
      const { statusCode } = await request(app.getHttpServer())
        .patch(`/category/${categories[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(409);
    });
  });

  describe('[DELETE] /category/:id', () => {
    it('should delete a category', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .delete(`/category/${categories[1].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(200);
      expect(body).toEqual({});
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .delete(`/category/${9999}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(404);
    });

    it('should return 400', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .delete(`/category/${categories[0].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(400);
    });
  });
});
