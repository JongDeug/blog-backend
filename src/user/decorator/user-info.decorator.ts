import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const UserInfo = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();

    if (!req?.user?.id) {
      throw new UnauthorizedException('사용자 정보를 찾을 수 없습니다');
    }

    return req.user;
  },
);
