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

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as 'strict',
  secure: true,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  registerUser(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  async loginUser(
    @Headers('authorization') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(token);

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
  }

  @Public()
  @Get('token/refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.rotateToken(
      req.cookies,
    );

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
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
  @Get('token/invalid/:id')
  invalid(@Param('id', ParseIntPipe) userId: number) {
    return this.authService.invalidToken(userId);
  }
}
