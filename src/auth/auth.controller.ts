import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';
import { Public } from './decorator/public.decorator';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from './decorator/rbac.decorator';
import { Role } from '@prisma/client';
import { Cookies } from 'src/common/decorator/cookies.decorator';
import { Authorization } from './decorator/authorization.decorator';
import {
  ApiBadRequestResponse,
  ApiBasicAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: true,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async loginUser(
    @Authorization() token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, authenticatedUser } =
      await this.authService.login(token);

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return {
      name: authenticatedUser.name,
      role: authenticatedUser.role,
    };
  }

  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
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

  @ApiNotFoundResponse({ description: 'Not Found' })
  @RBAC(Role.ADMIN)
  @Get('token/revoke/:id')
  revokeRefreshToken(@Param('id', ParseIntPipe) userId: number) {
    return this.authService.revokeToken(userId);
  }
}
