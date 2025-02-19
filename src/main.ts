import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './common/const/env.const';
import cookieParser from 'cookie-parser';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cors
  app.enableCors({
    origin: [
      'https://jongdeug.ddns.net',
      'http://localhost:3000',
      'http://localhost:8080',
    ],
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("Jongdeug's Blog")
    .setDescription('Blog API Documentation')
    .setVersion('0.1')
    .addBasicAuth()
    .addServer(process.env.NODE_ENV === 'production' ? '/api/nest' : '/') // 기본 경로 설정
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // authorize 영구 저장
    },
  });

  // Replacing the Nest logger with winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // 에러 발생 시킴
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 쿠키
  app.use(cookieParser());

  const configService = new ConfigService();
  await app.listen(configService.get<string>(envVariableKeys.serverPort));
}
bootstrap();
