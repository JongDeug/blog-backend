import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { envVariableKeys } from 'src/common/const/env.const';
import { Public } from '../decorator/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // context.getHandler(): 현재 실행 중인 라우트 핸들러 메서드를 반환
    const isPublic = this.reflector.get(Public, context.getHandler());

    // Public 데코레이터가 달려있으면 통과
    if (isPublic) return true;

    // 토큰 가져오기
    const req = context.switchToHttp().getRequest();
    const { accessToken } = req.cookies;

    try {
      // 토큰 타입 확인
      const decodedPayload = await this.jwtService.decode(accessToken);
      if (decodedPayload.type !== 'access') {
        throw new UnauthorizedException('잘못된 토큰입니다');
      }

      // 토큰 인증
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.configService.get(envVariableKeys.accessTokenSecret),
      });

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
