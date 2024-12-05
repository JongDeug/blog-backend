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
    it('should set cookies after successful login', async () => {
      const token = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';
      const accessToken = 'access token';
      const refreshToken = 'refresh token';
      const authenticatedUser = { id: 10, name: 'test' } as User;

      jest
        .spyOn(authService, 'login')
        .mockResolvedValue({ accessToken, refreshToken, authenticatedUser });

      await authController.loginUser(token, res);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        accessToken,
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        refreshToken,
        expect.any(Object),
      );
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

      await authController.refresh(refreshToken, res);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith(
        'accessToken',
        newTokens.accessToken,
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        newTokens.refreshToken,
        expect.any(Object),
      );
      expect(authService.rotateTokens).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('logoutUser', () => {
    it('should clear cookies after successful logout', async () => {
      const userId = 1;

      await authController.logoutUser(userId, res);

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenCalledWith('accessToken', '');
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', '');
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
