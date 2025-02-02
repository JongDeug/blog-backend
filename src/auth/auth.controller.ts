import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Public } from './decorator/public.decorator';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from './decorator/rbac.decorator';
import { Role } from '@prisma/client';
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

// const cookieOptions = {
//   path: '/',
//   httpOnly: true,
//   sameSite: 'strict' as const,
//   secure: true,
// };

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
  async loginUser(@Authorization() token: string) {
    const { accessToken, refreshToken, authenticatedUser } =
      await this.authService.login(token);

    return {
      accessToken,
      refreshToken,
      info: {
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        role: authenticatedUser.role,
      },
    };
  }

  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Public()
  @Get('token/refresh')
  async refresh(@Authorization() token: string) {
    const { accessToken, refreshToken } =
      await this.authService.rotateTokens(token);
    return { accessToken, refreshToken };
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
}
