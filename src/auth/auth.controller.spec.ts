import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { getMockRes } from '@jest-mock/express';
import { RegisterDto } from './dto/register.dto';
import { User } from '@prisma/client';
import { Response } from 'express';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: MockProxy<AuthService>;
  let res: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mock<AuthService>() }],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    res = getMockRes().res;
  });

  it('should be defined', () => {
    expect(authController).toBeDefined();
  });

  // given
  // when
  // then

  describe('registerUser', () => {
    it('should create a user', async () => {
      const registerDto: RegisterDto = {
        name: 'test',
        email: 'test@gmail.com',
        password: '1234',
      };
      const newUser = {
        name: registerDto.name,
        email: registerDto.email,
      } as User;

      jest.spyOn(authService, 'register').mockResolvedValue(newUser);

      const result = await authController.registerUser(registerDto);

      expect(result).toEqual(newUser);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('loginUser', () => {
    it('should return JWT tokens and user info after a successful login', async () => {
      const token = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';
      const accessToken = 'access token';
      const refreshToken = 'refresh token';
      const authenticatedUser = {
        id: 10,
        name: 'test',
        email: 'test@gmail.com',
        role: 'ADMIN',
      } as User;

      jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ accessToken, refreshToken, authenticatedUser });

      const result = await authController.loginUser(token);

      expect(result).toStrictEqual({
        accessToken,
        refreshToken,
        info: {
          name: authenticatedUser.name,
          email: authenticatedUser.email,
          role: authenticatedUser.role,
        },
      });
      expect(authService.login).toHaveBeenCalledWith(token);
    });
  });

  describe('refresh', () => {
    it('should set cookies after rotating both tokens using refresh token', async () => {
      const refreshToken = 'refresh token';
      const newTokens = {
        refreshToken: 'new refresh token',
        accessToken: 'new access token',
      };

      jest.spyOn(authService, 'rotateTokens').mockResolvedValue(newTokens);

      const result = await authController.refresh(refreshToken);

      expect(result).toStrictEqual({ ...newTokens });
      expect(authService.rotateTokens).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('logoutUser', () => {
    it('should clear cookies after successful logout', async () => {
      const userId = 1;

      await authController.logoutUser(userId);

      expect(authService.logout).toHaveBeenCalledWith(userId);
    });
  });

  describe('revoke', () => {
    it('should revoke refresh token using userId', async () => {
      const userId = 1;

      await authController.revokeRefreshToken(userId);

      expect(authService.revokeToken).toHaveBeenCalledWith(userId);
    });
  });
});
