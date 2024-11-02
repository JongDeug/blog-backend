import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const Cookies = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();

    if (!req.cookies?.[data]) {
      throw new BadRequestException(`쿠키에 ${data} 정보가 없습니다`);
    }

    return req.cookies?.[data];
  },
);
