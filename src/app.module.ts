import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import * as Joi from 'joi';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/guard/auth.guard';
import { CacheModule } from '@nestjs/cache-manager';
// import { redisStore } from 'cache-manager-redis-store';
import { UserModule } from './user/user.module';
import { RBACGuard } from './auth/guard/rbac.guard';
import { PostModule } from './post/post.module';
import { CommonController } from './common/common.controller';
import { CommonModule } from './common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { MulterConfigService } from './common/config/multer-config.service';

@Module({
  imports: [
    // 환경 변수 유효성 검사
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
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
    CacheModule.register({ isGlobal: true }),
    MulterModule.registerAsync({
      useClass: MulterConfigService,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    PostModule,
    CommonModule,
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
  ],
})
export class AppModule {}
