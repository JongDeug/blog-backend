import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import * as cookieParser from 'cookie-parser';

describe('CategoryController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
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
  });

  describe('[GET] /category', () => {
    it('should get all categories', async () => {
      const { body, statusCode } = await request(app.getHttpServer()).get(
        '/category',
      );

      expect(statusCode).toBe(200);
    });
  });
});
