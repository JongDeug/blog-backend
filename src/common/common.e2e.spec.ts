import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';

describe('CommentController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

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

    const user = await prismaService.user.create({
      data: {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
        role: Role.ADMIN,
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

    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);
    await prismaService.$disconnect();

    await app.close();
  });

  describe('[POST] /common/image', () => {
    it('should upload a image', async () => {
      const { body, statusCode } = await request(app.getHttpServer())
        .post('/common/image')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', Buffer.from('test'), 'jpg');

      expect(statusCode).toBe(201);
      expect(body.filename).toBeDefined();
    });
  });
});
