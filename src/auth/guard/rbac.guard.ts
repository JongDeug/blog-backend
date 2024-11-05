import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBAC } from '../decorator/rbac.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const role = this.reflector.get(RBAC, context.getHandler());

    const includesRole = Object.values(Role).includes(role);
    if (!includesRole) return true;

    const req = context.switchToHttp().getRequest();

    // authGuard -> rbacGuard : req.user 확인
    if (!req?.user) return false;

    const parseRoleToInt = (role: string): number =>
      role === Role.ADMIN ? 0 : 1;

    return parseRoleToInt(req.user.role) <= parseRoleToInt(role);
  }
}
