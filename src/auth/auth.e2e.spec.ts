import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, User } from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { tokenAge } from './const/token-age.const';
import { Cache } from 'cache-manager';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let users: User[];
  let refreshToken: string;
  let accessToken: string;

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
            role: Role.ADMIN,
          },
        }),
      ),
    );

    let authService = moduleFixture.get<AuthService>(AuthService);
    let cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
    refreshToken = await authService.issueToken(
      { id: users[0].id, role: users[0].role },
      true,
    );
    accessToken = await authService.issueToken(
      { id: users[0].id, role: users[0].role },
      false,
    );
    await cacheManager.set(
      `REFRESH_TOKEN_${users[0].id}`,
      refreshToken,
      tokenAge.REFRESH_TOKEN_INT,
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);
    await prismaService.$disconnect();

    await app.close();
  });

  describe('[POST] /auth/register', () => {
    it('should register a user', async () => {
      const dto = {
        name: 'test100',
        email: 'test100@gmail.com',
        password: '1234',
      };

      const { body, statusCode } = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dto);

      expect(statusCode).toBe(201);
      expect(body.name).toBe(dto.name);
      expect(body.email).toBe(dto.email);
      expect(body).not.toHaveProperty('password');
    });

    it('should return 409', async () => {
      const dto = {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
      };

      const { statusCode } = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dto);

      expect(statusCode).toBe(409);
    });
  });

  describe('[POST] /auth/login', () => {
    it('should return access and refresh tokens in cookies', async () => {
      const { body, statusCode, headers } = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Basic dGVzdDEwMEBnbWFpbC5jb206MTIzNA==`);

      expect(statusCode).toBe(201);
      expect(body).toStrictEqual({});

      const cookies = headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('accessToken=');
      expect(cookies[1]).toContain('refreshToken=');
    });

    it('should return 400 when the token format is invalid', async () => {
      const { statusCode, headers } = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Bearer dGVzdDEwMEBnbWFpbC5jb206MTIzNA==`);

      expect(statusCode).toBe(400);

      const cookies = headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });

    it('should return 404 when the user does not exist ', async () => {
      const { statusCode, headers } = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Basic dGVzdDVAZ21haWwuY29tOjEyMzQ=`);

      expect(statusCode).toBe(404);

      const cookies = headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });

    it('should return 403 when the password does not match', async () => {
      const { statusCode, headers } = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Basic dGVzdDEwMEBnbWFpbC5jb206MTExMTE=`);

      expect(statusCode).toBe(401);

      const cookies = headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
  });

  describe('[GET] /auth/token/refresh', () => {
    it('should refresh access and refresh tokens', async () => {
      const { body, statusCode, headers } = await request(app.getHttpServer())
        .get('/auth/token/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});

      const cookies = headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('accessToken=');
      expect(cookies[1]).toContain('refreshToken=');
    });

    it('should return 500 when the refresh token is invalid', async () => {
      const { statusCode, headers } = await request(app.getHttpServer())
        .get('/auth/token/refresh')
        .set('Cookie', [`refreshToken=123456`]);

      expect(statusCode).toBe(500);

      const cookies = headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });

    it('should return 401 when the refresh token is expired', async () => {
      const { statusCode, headers } = await request(app.getHttpServer())
        .get('/auth/token/refresh')
        .set('Cookie', [
          `refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjY4MCwicm9sZSI6IkFETUlOIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MzI1MzExMTAsImV4cCI6MTYzMjYxNzUxMH0.EmCBCWS979m1NwLISEfNavlspcQBJh6vys169frpmSA`,
        ]);

      expect(statusCode).toBe(401);

      const cookies = headers['set-cookie'];
      expect(cookies).toBeUndefined();
    });
  });

  describe('[GET] /auth/logout', () => {
    it('should clear cache and cookies on logout', async () => {
      // login
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Authorization', `Basic dGVzdDEwMEBnbWFpbC5jb206MTIzNA==`);
      const loginResponseCookies = loginResponse.headers['set-cookie'];
      const accessToken = loginResponseCookies[0].split('accessToken=')[1];

      // logout
      const { body, statusCode, headers } = await request(app.getHttpServer())
        .get('/auth/logout')
        .set('Cookie', [`accessToken=${accessToken}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});

      const cookies = headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('accessToken=;');
      expect(cookies[1]).toContain('refreshToken=;');
    });
  });

  describe('[GET] /auth/token/revoke/:id', () => {
    it('should delete the cache for the refresh token by userId', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .get(`/auth/token/revoke/${users[1].id}`)
        .set('Cookie', [`accessToken=${accessToken}`]);

      expect(statusCode).toBe(200);
      expect(body).toStrictEqual({});
    });

    it('should return 404', async () => {
      const { statusCode } = await request(app.getHttpServer())
        .get(`/auth/token/revoke/${9999}`)
        .set('Cookie', [`accessToken=${accessToken}`]);

      expect(statusCode).toBe(404);
    });
  });
});
