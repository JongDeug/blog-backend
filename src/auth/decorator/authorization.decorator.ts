import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const Authorization = createParamDecorator(
  (data: any, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();

    if (!req.headers['authorization']) {
      throw new BadRequestException('token을 입력해주세요 ');
    }

    return req.headers['authorization'];
  },
);
