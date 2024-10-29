import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBAC } from '../decorator/rbac.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.get(RBAC, context.getHandler());

    // 애초에 포함하고 있지 않으면 PASS
    if (!Object.values(Role).includes(role)) return true;

    const req = context.switchToHttp().getRequest();

    // 유저 체크
    if (!req?.user) return false;

    const parseNum = (role: string): number => (role === Role.ADMIN ? 0 : 1);

    return parseNum(req.user.role) <= parseNum(role);
  }
}
