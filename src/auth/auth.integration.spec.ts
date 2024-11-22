import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RegisterDto } from './dto/register.dto';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';

describe('AuthService - Integration Test', () => {
  let authService: AuthService;
  let userService: UserService;
  let prismaService: PrismaService;
  let cacheManager: Cache;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    await prismaService.user.create({
      data: {
        id: 1,
        name: 'integration1',
        email: 'integration1@gmail.com',
        password: '1234',
      },
    });

    await cacheManager.reset();
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);

    await prismaService.$disconnect();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const registerDto: RegisterDto = {
        name: 'register',
        email: 'register@gmail.com',
        password: '1234',
      };

      const result = await authService.register(registerDto);
      expect(result).toHaveProperty('email', 'register@gmail.com');
    });
  });

  // parseBasicToken 제외

  describe('login', () => {
    it('should authenticate and return access and refresh tokens', async () => {
      const rawToken = 'Basic cmVnaXN0ZXJAZ21haWwuY29tOjEyMzQ=';

      const result = await authService.login(rawToken);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should authenticate a user with email and password', async () => {
      const email = 'register@gmail.com';
      const password = '1234';

      const result = await authService.authenticate(email, password);
      expect(result.email).toBe(email);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      const email = 'none@gmail.com';
      const password = '1234';

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('issueToken', () => {
    it('should issue a access token when isRefresh is false', async () => {
      const result = await authService.issueToken(
        { id: 1, role: 'USER' },
        false,
      );
      expect(result).toBeDefined();
    });

    it('should issue a refresh token when isRefresh is true', async () => {
      const result = await authService.issueToken(
        { id: 1, role: 'USER' },
        true,
      );
      expect(result).toBeDefined();
    });
  });

  describe('rotateTokens', () => {
    it('should rotate tokens using the refresh token', async () => {
      const token = (
        await authService.login('Basic cmVnaXN0ZXJAZ21haWwuY29tOjEyMzQ=')
      ).refreshToken;
      const id = (await userService.findUserByEmail('register@gmail.com')).id;

      // 캐시 체크까지
      const result = await authService.rotateTokens(token);
      const cache = await cacheManager.get(`REFRESH_TOKEN_${id}`);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(cache).toBeDefined();
    });

    it('should throw an UnauthorizedException when the token is expired', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJyb2xlIjoiVVNFUiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzMyMjU5MzEzLCJleHAiOjE2MzIzNDU3MTN9.6UxWvpHf7vd_RlmKw6YhkCNZxkpZ5NYT__lPMm8BNWc';
      await expect(authService.rotateTokens(expiredToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should delete the cache for the refresh token by userId', async () => {
      // login
      await authService.login('Basic cmVnaXN0ZXJAZ21haWwuY29tOjEyMzQ=');
      const id = (await userService.findUserByEmail('register@gmail.com')).id;

      await expect(
        cacheManager.get(`REFRESH_TOKEN_${id}`),
      ).resolves.toBeDefined();

      // logout
      await expect(authService.logout(id)).resolves.toBeUndefined();

      await expect(
        cacheManager.get(`REFRESH_TOKEN_${id}`),
      ).resolves.toBeUndefined();
    });
  });

  describe('revokeToken', () => {
    it('should delete the cache for the refresh token by userId', async () => {
      // login
      await authService.login('Basic cmVnaXN0ZXJAZ21haWwuY29tOjEyMzQ=');
      const id = (await userService.findUserByEmail('register@gmail.com')).id;

      await expect(
        cacheManager.get(`REFRESH_TOKEN_${id}`),
      ).resolves.toBeDefined();

      // revoke
      await expect(authService.revokeToken(id)).resolves.toBeUndefined();

      await expect(
        cacheManager.get(`REFRESH_TOKEN_${id}`),
      ).resolves.toBeUndefined();
    });
  });

  // hashedPassword 제외

  // comparePassword 제외
});
