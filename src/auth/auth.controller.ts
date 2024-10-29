import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Request, Response } from 'express';
import { Public } from './decorator/public.decorator';
import { UserId } from 'src/user/decorator/user-id.decorator';

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

  // RBAC() 필요
  @Post('token/invalid')
  invalid(@Body('userId') userId: string) {
    return this.authService.invalidToken(userId);
  }

  @Get('logout')
  async logoutUser(
    @UserId() userId: string, // 커스텀 데코레이터
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);

    res.cookie('accessToken', '');
    res.cookie('refreshToken', '');
    return true;
  }
}
