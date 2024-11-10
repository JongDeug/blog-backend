import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Request, Response } from 'express';
import { Public } from './decorator/public.decorator';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from './decorator/rbac.decorator';
import { Role } from '@prisma/client';
import { Cookies } from 'src/common/decorator/cookies.decorator';
import { Authorization } from './decorator/authorization.decorator';
import { ApiBasicAuth } from '@nestjs/swagger';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: true,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  registerUser(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiBasicAuth()
  @Public()
  @Post('login')
  async loginUser(
    @Authorization() token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(token);

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
  }

  @Public()
  @Get('token/refresh')
  async refresh(
    @Cookies('refreshToken') refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const newTokens = await this.authService.rotateTokens(refreshToken);

    res.cookie('accessToken', newTokens.accessToken, cookieOptions);
    res.cookie('refreshToken', newTokens.refreshToken, cookieOptions);
  }

  @Get('logout')
  logoutUser(
    @UserId() userId: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.cookie('accessToken', '');
    res.cookie('refreshToken', '');

    return this.authService.logout(userId);
  }

  @RBAC(Role.ADMIN)
  @Get('token/revoke/:id')
  revokeRefreshToken(@Param('id', ParseIntPipe) userId: number) {
    return this.authService.revokeToken(userId);
  }
}
