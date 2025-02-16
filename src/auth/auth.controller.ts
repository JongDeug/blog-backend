import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Public } from './decorator/public.decorator';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from './decorator/rbac.decorator';
import { Role, User } from '@prisma/client';
import { Authorization } from './decorator/authorization.decorator';
import {
  ApiBadRequestResponse,
  ApiBasicAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GoogleAuthGuard } from './guard/google-auth.guard';
import { UserInfo } from 'src/user/decorator/user-info.decorator';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @ApiCreatedResponse({ description: '유저 정보' })
  @ApiConflictResponse({ description: 'Conflict' })
  @Public()
  @Post('register')
  registerUser(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiBadRequestResponse({ description: 'Bad Request' })
  @ApiNotFoundResponse({ description: 'Not Found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiBasicAuth()
  @Public()
  @Post('login')
  async loginUser(@Authorization() token: string) {
    const { accessToken, refreshToken } = await this.authService.login(token);

    return {
      accessToken,
      refreshToken,
    };
  }

  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Public()
  @Get('token/refresh')
  async refresh(@Authorization() token: string) {
    return this.authService.rotateTokens(token);
  }

  @Get('logout')
  logoutUser(@UserId() userId: number) {
    return this.authService.logout(userId);
  }

  @ApiNotFoundResponse({ description: 'Not Found' })
  @RBAC(Role.ADMIN)
  @Get('token/revoke/:id')
  revokeRefreshToken(@Param('id', ParseIntPipe) userId: number) {
    return this.authService.revokeToken(userId);
  }

  @Get('to-google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(
    @UserInfo() user: Omit<User, 'password'>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.issueJWTs(user);

    res.cookie(
      'session',
      JSON.stringify({ accessToken, refreshToken }),
      cookieOptions,
    );

    return res.redirect(
      process.env.NODE_ENV === 'production'
        ? `${this.configService.get(envVariableKeys.serverOrigin)}/api/next/auth/google`
        : `http://localhost:3000/api/next/auth/google`,
    );
  }
}
