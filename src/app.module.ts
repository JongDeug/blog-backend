import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import * as Joi from 'joi';

@Module({
  imports: [
    // 환경 변수 유효성 검사
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        SERVER_PORT: Joi.number().required(),
        DB_URL: Joi.string().required(),
        DB_TYPE: Joi.string().valid('mysql').required(),
        DB_PORT: Joi.number().required(),
        DB_PWD: Joi.number().required(),
        REDIS_URL: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PWD: Joi.number().required(),
        PASSWORD_SALT: Joi.number().required(),
        JWT_SECRET: Joi.string().required(),
        MAIL_ID: Joi.string().required(),
        MAIL_PWD: Joi.string().required(),
      }),
      isGlobal: true,
    }),
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
