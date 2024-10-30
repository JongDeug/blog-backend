import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { envVariableKeys } from 'src/common/const/env.const';
import { Public } from '../decorator/public.decorator';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // context.getHandler(): 현재 실행 중인 라우트 핸들러 메서드를 반환
    const isPublic = this.reflector.get(Public, context.getHandler());

    // Public 데코레이터가 달려있으면 통과
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const { accessToken } = req.cookies;

    if (!accessToken) {
      throw new UnauthorizedException('잘못된 토큰입니다');
    }

    // 캐시 검색
    const cachedPayload = await this.cacheManager.get(
      `ACCESS_TOKEN_${accessToken}`,
    );
    if (cachedPayload) {
      req.user = cachedPayload;
      return true;
    }

    try {
      // 토큰 인증
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get(envVariableKeys.accessTokenSecret),
      });

      // 토큰 타입 확인
      if (payload.type !== 'access') {
        throw new UnauthorizedException('잘못된 토큰입니다');
      }

      // 캐시 생성
      const expiryDate = payload['exp'] * 1000; // unix timestamp, 초 단위
      const now = Date.now(); // unix timestamp, 밀리초 단위
      const differenceInMilliSeconds = expiryDate - now;

      await this.cacheManager.set(
        `ACCESS_TOKEN_${accessToken}`,
        payload,
        Math.max(differenceInMilliSeconds - 20, 1),
      );

      req.user = payload;

      return true;
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        throw new UnauthorizedException('만료된 토큰입니다');
      }
      return false;
    }
  }
}
