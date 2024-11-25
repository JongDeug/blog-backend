import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let users: User[];
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

    users = await Promise.all(
      [0, 1].map((idx) =>
        prismaService.user.create({
          data: {
            name: `test${idx}`,
            email: `test${idx}@gmail.com`,
            password: '1234',
            role: idx === 0 ? 'ADMIN' : 'USER',
          },
        }),
      ),
    );

    let authService = await moduleFixture.get<AuthService>(AuthService);
    token = await authService.issueToken(
      { id: users[0].id, role: users[0].role },
      false,
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);
    await prismaService.$disconnect();
    await app.close();
  });

  describe('[GET] /user', () => {
    it('should get all users without password', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .get('/user')
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0]).not.toHaveProperty('password');
    });
  });

  describe('[GET] /user/:id', () => {
    it('should get a user without password', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .get(`/user/${users[0].id}`)
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(200);
      expect(body.name).toBe(users[0].name);
      expect(body.email).toBe(users[0].email);
      expect(body).not.toHaveProperty('password');
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .get(`/user/${9999}`)
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(404);
    });
  });

  describe('[DELETE] /user/:id', () => {
    it('should delete a user', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .del(`/user/${users[1].id}`)
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/user/${9999}`)
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(404);
    });

    it('should return 400 when the user to remove is an admin', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .del(`/user/${users[0].id}`)
        .set('Cookie', [`accessToken=${token}`]);

      expect(statusCode).toBe(400);
    });
  });
});
