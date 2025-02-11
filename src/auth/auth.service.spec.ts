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
import { UserService } from 'src/user/user.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let configService: MockProxy<ConfigService>;
  let jwtService: MockProxy<JwtService>;
  let userService: MockProxy<UserService>;
  let cacheManager: MockProxy<Cache>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: JwtService, useValue: mock<JwtService>() },
        { provide: UserService, useValue: mock<UserService>() },
        { provide: CACHE_MANAGER, useValue: mock<Cache>() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaMock = module.get(PrismaService);
    configService = module.get(ConfigService);
    jwtService = module.get(JwtService);
    userService = module.get(UserService);
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

      jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(null);
      jest
        .spyOn(authService, 'hashPassword')
        .mockResolvedValueOnce('hashedPassword');
      jest.spyOn(prismaMock.user, 'create').mockResolvedValue(newUser);

      const result = await authService.register(registerDto);

      expect(result).toEqual(newUser);
      expect(userService.findUserByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(authService.hashPassword).toHaveBeenCalledWith(
        registerDto.password,
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

      jest.spyOn(authService, 'hashPassword');
      jest.spyOn(userService, 'findUserByEmail').mockResolvedValue(foundUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(authService.hashPassword).not.toHaveBeenCalled();
    });
  });

  describe('parseBearerToken', () => {
    it('should parse a valid Bearer token', () => {
      const rawToken = 'Bearer validToken123';

      const result = authService.parseBearerToken(rawToken);

      expect(result).toBe('validToken123');
    });

    it('should throw a BadRequestException for invalid token format', () => {
      const rawToken = 'Bearer validToken123 extraPart';

      expect(() => authService.parseBearerToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw a BadRequestException if the scheme is not Bearer', () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';

      expect(() => authService.parseBearerToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw an BadRequestException if token is missing', () => {
      const rawToken = 'Bearer ';

      expect(() => authService.parseBearerToken(rawToken)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseBasicToken', () => {
    it('should parse a valid Basic Token', () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA==';

      const result = authService.parseBasicToken(rawToken);

      expect(result).toEqual({ email: 'test@gmail.com', password: '1234' });
    });

    it('should throw a BadRequestException for invalid token format', () => {
      const rawToken = 'Basic dGVzdEBnbWFpbC5jb206MTIzNA== XXXXXX';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw a BadRequestException if the scheme is not Basic', () => {
      const rawToken = 'Bearer dGVzdEBnbWFpbC5jb206MTIzNA==';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });

    it('should throw a BadRequestException for invalid token format', () => {
      const rawToken = 'Basic invalidBase64token==';

      expect(() => authService.parseBasicToken(rawToken)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('authenticate', () => {
    const email = 'test@gmail.com';
    const password = '1234';
    let foundUser;
    let mockFindUserByEmail: jest.SpyInstance;
    let mockComparePassword: jest.SpyInstance;

    beforeEach(() => {
      foundUser = { email, password } as User;
      mockFindUserByEmail = jest.spyOn(userService, 'findUserByEmail');
      mockComparePassword = jest.spyOn(authService, 'comparePassword');
    });

    it('should authenticate a user with correct credentials', async () => {
      mockFindUserByEmail.mockResolvedValue(foundUser);
      mockComparePassword.mockResolvedValue(undefined);

      const result = await authService.authenticate(email, password);

      expect(result).toEqual(foundUser);
      expect(mockFindUserByEmail).toHaveBeenCalledWith(email);
      expect(mockComparePassword).toHaveBeenCalledWith(
        password,
        foundUser.password,
      );
    });

    it('should throw a NotFoundException if the user does not exist', async () => {
      mockFindUserByEmail.mockResolvedValue(null);

      await expect(authService.authenticate(email, password)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockComparePassword).not.toHaveBeenCalled();
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

      expect(result).toEqual({ accessToken, refreshToken, authenticatedUser });
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
      const rawToken = 'Bearer mock-refresh-token';
      const token = 'mock-refresh-token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'refresh',
      };
      const accessToken = 'access token';
      const refreshToken = 'refresh token';

      jest.spyOn(authService, 'parseBearerToken').mockReturnValue(token);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(token);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(accessToken);
      jest.spyOn(authService, 'issueToken').mockResolvedValueOnce(refreshToken);

      const result = await authService.rotateTokens(rawToken);

      expect(result).toEqual({ accessToken, refreshToken });
      expect(authService.parseBearerToken).toHaveBeenCalledWith(rawToken);
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
      const rawToken = 'Bearer mock-invalid-refresh-token';
      const token = 'mock-invalid-refresh-token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'access',
      };

      jest.spyOn(authService, 'parseBearerToken').mockReturnValue(token);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);

      await expect(authService.rotateTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.parseBearerToken).toHaveBeenCalled();
      expect(jwtService.verifyAsync).toHaveBeenCalled();
      expect(cacheManager.get).not.toHaveBeenCalled();
    });

    it('should throw an error for revoked refresh token', async () => {
      const rawToken = 'Bearer mock-revoked-refresh-token';
      const token = 'mock-revoked-refresh-token';
      const payload = {
        sub: 1,
        role: 'ADMIN',
        type: 'refresh',
      };

      jest.spyOn(authService, 'parseBearerToken').mockReturnValue(token);
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(payload);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      await expect(authService.rotateTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.parseBearerToken).toHaveBeenCalled();
      expect(jwtService.verifyAsync).toHaveBeenCalled();
      expect(cacheManager.get).toHaveBeenCalled();
      expect(jest.spyOn(authService, 'issueToken')).not.toHaveBeenCalled();
    });

    it('should throw an error for expired token', async () => {
      const rawToken = 'Bearer mock-invalid-refresh-token';
      const token = 'mock-invalid-refresh-token';
      const error = new Error();
      error.name = 'TokenExpiredError';

      jest.spyOn(authService, 'parseBearerToken').mockReturnValue(token);
      jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(error);

      await expect(authService.rotateTokens(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authService.parseBearerToken).toHaveBeenCalled();
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

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);

      await authService.revokeToken(userId);

      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(cacheManager.del).toHaveBeenCalledWith(
        `REFRESH_TOKEN_${foundUser.id}`,
      );
    });
  });

  describe('hashPassword', () => {
    it('should hash the password', async () => {
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashedPassword'));
      jest.spyOn(configService, 'get').mockReturnValue(expect.any(String));

      const result = await authService.hashPassword('password');

      expect(result).toEqual('hashedPassword');
      expect(bcrypt.hash).toHaveBeenCalledWith('password', expect.any(String));
    });
  });

  describe('comparePassword', () => {
    it('should not throw an error if the password matches the hashed password', async () => {
      const isCorrectPassword = true;

      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(isCorrectPassword));

      await expect(
        authService.comparePassword('password', 'hashedPassword'),
      ).resolves.toEqual(undefined);
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashedPassword');
    });

    it('should throw an UnauthorizedException if the password does not match the hashed password', async () => {
      const isCorrectPassword = false;

      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(isCorrectPassword));

      await expect(
        authService.comparePassword('password', 'hashedPassword'),
      ).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalled();
    });
  });
});
