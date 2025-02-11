import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Category, Role, Tag, User } from '@prisma/client';
import * as request from 'supertest';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';

describe('TagController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let user: User;
  let tags: Tag[];
  let category: Category;
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
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    user = await prismaService.user.create({
      data: {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
        role: Role.ADMIN, // USER 면 RBAC에 걸림
      },
    });

    tags = await Promise.all(
      [0, 1].map((idx) =>
        prismaService.tag.create({
          data: { name: `tag${idx}` },
        }),
      ),
    );

    category = await prismaService.category.create({
      data: { name: 'category ' },
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
          connect: { name: category.name },
        },
        tags: {
          connect: { name: tags[1].name },
        },
      },
    });

    const authService = moduleFixture.get<AuthService>(AuthService);
    token = await authService.issueToken(
      { id: user.id, role: user.role },
      false,
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteTags = prismaService.tag.deleteMany();
    const deleteUsers = prismaService.user.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteCategory,
      deleteTags,
      deleteUsers,
    ]);
    await prismaService.$disconnect();

    await app.close();
  });

  describe('[POST] /tag', () => {
    it('should create a tag', async () => {
      const dto = {
        name: 'new tag',
      };
      const { body, statusCode } = await request(app.getHttpServer())
        .post('/tag')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(201);
      expect(body.name).toBe(dto.name);
    });

    it('should return 409', async () => {
      const dto = {
        name: 'tag1',
      };
      const { statusCode } = await request(app.getHttpServer())
        .post('/tag')
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(409);
    });
  });

  describe('[GET] /tag', () => {
    it('should get all tags', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .get('/tag')
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(tags.length + 1);
    });
  });

  describe('[GET] /tag/:id', () => {
    it('should get a tag', async () => {
      const { body, statusCode } = await request(app.getHttpServer()).get(
        `/tag/${tags[0].id}`,
      );

      expect(statusCode).toBe(200);
      expect(body.name).toBe(tags[0].name);
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer()).get(
        `/tag/${9999}`,
      );

      expect(statusCode).toBe(404);
    });
  });

  describe('[PATCH] /tag/:id', () => {
    it('should update a tag', async () => {
      const dto = {
        name: 'updated tag',
      };
      const { body, statusCode } = await request(app.getHttpServer())
        .patch(`/tag/${tags[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const dto = {
        name: 'updated tag',
      };
      const { statusCode } = await request(app.getHttpServer())
        .patch(`/tag/${9999}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(404);
    });

    it('should return 409', async () => {
      const dto = {
        name: 'tag1',
      };
      const { statusCode } = await request(app.getHttpServer())
        .patch(`/tag/${tags[0].id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(dto);

      expect(statusCode).toBe(409);
    });
  });

  describe('[DELETE] /tag/:id', () => {
    it('should delete a tag', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .del(`/tag/${tags[0].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/tag/${9999}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(404);
    });

    it('should return 400', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/tag/${tags[1].id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(statusCode).toBe(400);
    });
  });
});
