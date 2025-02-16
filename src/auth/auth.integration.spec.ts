import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RegisterDto } from './dto/register.dto';
import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { Role, User } from '@prisma/client';

describe('AuthService - Integration Test', () => {
  let app: INestApplication;
  let authService: AuthService;
  let userService: UserService;
  let prismaService: PrismaService;
  let cacheManager: Cache;

  let user: User;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);

    // SEEDING
    user = await prismaService.user.create({
      data: {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
        role: Role.ADMIN,
      },
    });

    await cacheManager.reset();
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);
    await prismaService.$disconnect();

    await app.close();
  });

  describe('register', () => {
    it('should register a user', async () => {
      const registerDto: RegisterDto = {
        name: 'register',
        email: 'register@gmail.com',
        password: '1234',
      };

      const result = await authService.register(registerDto);

      expect(result).toHaveProperty('email', registerDto.email);
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
        { id: user.id, role: user.role, email: user.email },
        false,
      );

      expect(result).toBeDefined();
    });

    it('should issue a refresh token when isRefresh is true', async () => {
      const result = await authService.issueToken(
        { id: user.id, role: user.role, email: user.email },
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

      const result = await authService.rotateTokens(`Bearer ${token}`);
      const cache = await cacheManager.get(`REFRESH_TOKEN_${id}`);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(cache).toBeDefined();
    });

    it('should throw an UnauthorizedException when the token is expired', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjU1LCJyb2xlIjoiVVNFUiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzMyMjU5MzEzLCJleHAiOjE2MzIzNDU3MTN9.6UxWvpHf7vd_RlmKw6YhkCNZxkpZ5NYT__lPMm8BNWc';

      await expect(
        authService.rotateTokens(`Bearer ${expiredToken}`),
      ).rejects.toThrow(UnauthorizedException);
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

  describe('bcrypt', () => {
    const password = '1234';
    let hashedPassword: string;

    describe('hashedPassword', () => {
      it('should hash the password and return the hashed value', async () => {
        const result = await authService.hashPassword(password);

        expect(result).toBeDefined();

        hashedPassword = result;
      });
    });

    describe('comparePassword', () => {
      it('should verify that the password matches the hashed password', async () => {
        await expect(
          authService.comparePassword(password, hashedPassword),
        ).resolves.toBeUndefined();
      });

      it('should throw an UnauthorizedException when the password does not match the hashed password', async () => {
        await expect(
          authService.comparePassword('wrong', hashedPassword),
        ).rejects.toThrow(UnauthorizedException);
      });
    });
  });
});
