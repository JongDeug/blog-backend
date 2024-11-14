import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import * as Joi from 'joi';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/guard/auth.guard';
import { CacheModule } from '@nestjs/cache-manager';
import { UserModule } from './user/user.module';
import { RBACGuard } from './auth/guard/rbac.guard';
import { PostModule } from './post/post.module';
import { CommonController } from './common/common.controller';
import { CommonModule } from './common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from './common/config/multer-config.service';
import { CategoryModule } from './category/category.module';
import { TagModule } from './tag/tag.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { LoggingInterceptor } from './common/interceptor/logging.interceptor';
import { join } from 'path';
import { PrismaClientExceptionFilter } from './common/filter/prisma-client-exception.filter';

@Module({
  imports: [
    // 환경 변수 유효성 검사
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        SERVER_ORIGIN: Joi.string().required(),
        SERVER_PORT: Joi.number().required(),
        DB_URL: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_PWD: Joi.number().required(),
        REDIS_URL: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PWD: Joi.number().required(),
        HASH_ROUNDS: Joi.number().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        MAIL_ID: Joi.string().required(),
        MAIL_PWD: Joi.string().required(),
      }),
      isGlobal: true,
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({
              all: true,
            }),
            winston.format.timestamp(),
            winston.format.printf(
              ({ level, message, context, timestamp }) =>
                `${new Date(timestamp).toLocaleString()} [${context}] ${level} ${message}`,
            ),
          ),
        }),
        new winston.transports.File({
          dirname: join(process.cwd(), 'logs'),
          filename: 'logs.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(
              ({ level, message, context, timestamp }) =>
                `${new Date(timestamp).toLocaleString()} [${context}] ${level} ${message}`,
            ),
          ),
        }),
      ],
    }),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    PostModule,
    CommonModule,
    CategoryModule,
    TagModule,
  ],
  controllers: [CommonController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RBACGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaClientExceptionFilter,
    },
  ],
})
export class AppModule {}
