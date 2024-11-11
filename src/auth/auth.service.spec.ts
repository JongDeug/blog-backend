import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';
import { PrismaClient, Role, User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { tokenAge } from './const/token-age.const';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let configService: MockProxy<ConfigService>;
  let jwtService: MockProxy<JwtService>;
  let cacheManager: MockProxy<Cache>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: JwtService, useValue: mock<JwtService>() },
        { provide: CACHE_MANAGER, useValue: mock<Cache>() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaMock = module.get(PrismaService);
    configService = module.get(ConfigService);
    jwtService = module.get(JwtService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  // given
  // when
  // then

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'test',
      email: 'test@gmail.com',
      password: '1234',
    };
    it('should create a user', async () => {
      const newUser = {
        name: registerDto.name,
        email: registerDto.email,
      } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashedPassword'))
        .mockClear();
      jest.spyOn(configService, 'get').mockReturnValue(expect.any(String));
      jest.spyOn(prismaMock.user, 'create').mockResolvedValue(newUser);

      const result = await authService.register(registerDto);

      expect(result).toEqual(newUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(
        registerDto.password,
        expect.any(String),
      );
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          ...registerDto,
          password: 'hashedPassword',
        },
        omit: {
          password: true,
        },
      });
    });

    it('should throw a ConflictException when the user exists', async () => {
      const foundUser = { name: 'test', email: 'test@gmail.com' } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });
  });

  describe('parseBasicToken', () => {
    it('should parse a valid Basic Token', () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';

      const result = authService.parseBasicToken(rawToken);

      expect(result).toEqual({ email: 'test@gmail.com', password: '1234' });
    });

    it('should throw an error for invalid token format', () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA== XXXXXX';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw an error for invalid token format', () => {
      const rawToken = 'Bearer dGVzdEBnbWFpbC5jb206MTIzNA==';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw an error for invalid token format', () => {
      const rawToken = 'Basic invalidBase64token==';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('authenticate', () => {
    const email = 'test@gmail.com';
    const password = '1234';

    it('should authenticate a user with correct credentials', async () => {
      const foundUser = { email, password } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));

      const result = await authService.authenticate(email, password);

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, foundUser.password);
    });

    it('should throw a NotFoundException when the user is not registered', async () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw an error for invalid credentials', async () => {
      const foundUser = { email, password } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalled();
    });
  });

  describe('issueToken', () => {
    it('should issue an access token', async () => {
      const user = { id: 1, role: Role.ADMIN };
      const isRefresh = false;
      const token = 'access token';

      jest.spyOn(configService, 'get').mockReturnValueOnce('accessSecret');
      jest.spyOn(configService, 'get').mockReturnValueOnce('refreshSecret');
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const result = await authService.issueToken(user, isRefresh);

      expect(result).toEqual(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: user.id,
          role: user.role,
          type: 'access',
        },
        {
          secret: 'accessSecret',
          expiresIn: tokenAge.ACCESS_TOKEN_INT,
        },
      );
    });

    it('should issue a refresh token', async () => {
      const user = { id: 1, role: Role.ADMIN };
      const isRefresh = true;
      const token = 'refresh token';

      jest.spyOn(configService, 'get').mockReturnValueOnce('accessSecret');
      jest.spyOn(configService, 'get').mockReturnValueOnce('refreshSecret');
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue(token);

      const result = await authService.issueToken(user, isRefresh);

      expect(result).toEqual(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: user.id,
          role: user.role,
          type: 'refresh',
        },
        {
          secret: 'refreshSecret',
          expiresIn: tokenAge.REFRESH_TOKEN_STRING,
        },
      );
    });
  });

  describe('login', () => {
    it('should authenticate the user successfully', async () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';
      const email = 'test@gmail.com';
      const password = '1234';
      const authenticatedUser = { id: 1, email } as User;
      const accessToken = 'access token';
      const refreshToken = 'refresh token';

      jest
        .spyOn(authService, 'parseBasicToken')
        .mockReturnValue({ email, password });
      jest
        .spyOn(authService, 'authenticate')
        .mockResolvedValue(authenticatedUser);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(accessToken);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(refreshToken);

      const result = await authService.login(rawToken);

      expect(result).toEqual({ accessToken, refreshToken });
      expect(authService.parseBasicToken).toHaveBeenCalledWith(rawToken);
      expect(authService.authenticate).toHaveBeenCalledWith(email, password);
      expect(authService.issueToken).toHaveBeenNthCalledWith(
        1,
        authenticatedUser,
        false,
      );
      expect(authService.issueToken).toHaveBeenNthCalledWith(
        2,
        authenticatedUser,
        true,
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        `REFRESH_TOKEN_${authenticatedUser.id}`,
        refreshToken,
        tokenAge.REFRESH_TOKEN_INT,
      );
    });
  });

  describe('rotateTokens', () => {
    it('should rotate both access and refresh tokens using refresh token', async () => {
      const token = 'refresh token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'refresh',
      };
      const accessToken = 'access token';
      const refreshToken = 'refresh token';

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(token);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(accessToken);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(refreshToken);

      const result = await authService.rotateTokens(token);

      expect(result).toEqual({ accessToken, refreshToken });
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        token,
        expect.any(Object),
      );
      expect(cacheManager.get).toHaveBeenCalledWith(
        `REFRESH_TOKEN_${payload.sub}`,
      );
      expect(authService.issueToken).toHaveBeenNthCalledWith(
        1,
        { id: payload.sub, role: payload.role },
        false,
      );
      expect(authService.issueToken).toHaveBeenNthCalledWith(
        2,
        { id: payload.sub, role: payload.role },
        true,
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        `REFRESH_TOKEN_${payload.sub}`,
        refreshToken,
        tokenAge.REFRESH_TOKEN_INT,
      );
    });

    it('should throw an error if token type is not refresh', async () => {
      const token = 'invalid token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'access',
      };

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

      await expect(authService.rotateTokens(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).toHaveBeenCalled();
      expect(cacheManager.get).not.toHaveBeenCalled();
    });

    it('should throw an error for revoked refresh token', async () => {
      const token = 'revoked token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'refresh',
      };

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      await expect(authService.rotateTokens(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).toHaveBeenCalled();
      expect(cacheManager.get).toHaveBeenCalled();
      expect(jest.spyOn(authService, 'issueToken')).not.toHaveBeenCalled();
    });

    it('should throw an error for expired token', async () => {
      const token = 'invalid token';
      const error = new Error();
      error.name = 'TokenExpiredError';

      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(error);

      await expect(authService.rotateTokens(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verifyAsync).toHaveBeenCalled();
      expect(cacheManager.get).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const userId = 1;

      await authService.logout(userId);

      expect(jest.spyOn(cacheManager, 'del')).toHaveBeenCalledWith(
        `REFRESH_TOKEN_${userId}`,
      );
    });
  });

  describe('revokeToken', () => {
    it('should revoke the token using userId', async () => {
      const userId = 1;
      const foundUser = { id: userId } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      await authService.revokeToken(userId);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(cacheManager.del).toHaveBeenCalledWith(`REFRESH_TOKEN_${userId}`);
    });

    it('should throw a NotFoundException when the user does not exists', async () => {
      const userId = 1;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      await expect(authService.revokeToken(userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
