import { Controller, Get, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from '@prisma/client';
import { ApiBadRequestResponse, ApiNotFoundResponse } from '@nestjs/swagger';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @RBAC(Role.ADMIN)
  findAll() {
    return this.userService.findAll();
  }

  @ApiNotFoundResponse({ description: 'Not Found' })
  @Get(':id')
  @RBAC(Role.ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findUserWithoutPassword(id);
  }

  @ApiNotFoundResponse({ description: 'Not Found' })
  @ApiBadRequestResponse({ description: 'Bad Request' })
  @Delete(':id')
  @RBAC(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
