import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { tokenAge } from './const/token-age.const';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async register(registerDto: RegisterDto) {
    const foundUser = await this.userService.findUserByEmail(registerDto.email);
    if (foundUser) throw new ConflictException('이미 가입한 이메일입니다');

    const hashedPassword = await this.hashPassword(registerDto.password);

    const newUser = await this.prismaService.user.create({
      data: {
        ...registerDto,
        password: hashedPassword,
      },
      omit: {
        password: true,
      },
    });

    return newUser;
  }

  parseBearerToken(rawToken: string) {
    const splitBearerToken = rawToken.split(' ');

    if (splitBearerToken.length !== 2) {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    const [bearer, token] = splitBearerToken;
    if (bearer.toLowerCase() !== 'bearer') {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    if (!token) {
      throw new BadRequestException('잘못된 토큰입니다');
    }

    return token;
  }

  parseBasicToken(rawToken: string) {
    const splitBasicToken = rawToken.split(' ');

    if (splitBasicToken.length !== 2) {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    const [basic, token] = splitBasicToken;

    if (basic.toLowerCase() !== 'basic') {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    // Base64 decoding
    const decodedBase64 = Buffer.from(token, 'base64').toString('utf-8');
    const splitDecodedBase64 = decodedBase64.split(':');

    if (splitDecodedBase64.length !== 2) {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    const [email, password] = splitDecodedBase64;

    return {
      email,
      password,
    };
  }

  async login(rawToken: string) {
    const { email, password } = this.parseBasicToken(rawToken);

    const authenticatedUser = await this.authenticate(email, password);

    return this.issueJWTs(authenticatedUser);
  }

  async issueJWTs(authenticatedUser: {
    id: number;
    role: Role;
    email: string;
  }) {
    const accessToken = await this.issueToken(authenticatedUser, false);
    const refreshToken = await this.issueToken(authenticatedUser, true);

    // 캐시 생성(refresh)
    await this.cacheManager.set(
      `REFRESH_TOKEN_${authenticatedUser.id}`,
      refreshToken,
      tokenAge.REFRESH_TOKEN_INT,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async authenticate(email: string, password: string) {
    const foundUser = await this.userService.findUserByEmail(email);
    if (!foundUser || !foundUser.password)
      throw new NotFoundException('가입된 이메일이 아닙니다');

    await this.comparePassword(password, foundUser.password);

    return foundUser;
  }

  issueToken(
    payload: { id: number; role: Role; email: string },
    isRefresh: boolean,
  ) {
    const accessTokenSecret = this.configService.get(
      envVariableKeys.accessTokenSecret,
    );
    const refreshTokenSecret = this.configService.get(
      envVariableKeys.refreshTokenSecret,
    );

    return this.jwtService.signAsync(
      {
        sub: payload.id,
        role: payload.role,
        email: payload.email,
        type: isRefresh ? 'refresh' : 'access',
      },
      {
        secret: isRefresh ? refreshTokenSecret : accessTokenSecret,
        expiresIn: isRefresh
          ? tokenAge.REFRESH_TOKEN_STRING
          : tokenAge.ACCESS_TOKEN_INT,
      },
    );
  }

  async rotateTokens(rawToken: string) {
    const token = this.parseBearerToken(rawToken);

    try {
      // 토큰 인증
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get(envVariableKeys.refreshTokenSecret),
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('잘못된 토큰입니다');
      }

      // 캐시값과 비교
      const cachedRefreshToken = await this.cacheManager.get(
        `REFRESH_TOKEN_${payload.sub}`,
      );
      if (cachedRefreshToken !== token) {
        throw new UnauthorizedException('유효하지 않는 토큰입니다');
      }

      // 토큰 재발급
      const accessToken = await this.issueToken(
        { id: payload.sub, role: payload.role, email: payload.email },
        false,
      );
      const refreshToken = await this.issueToken(
        { id: payload.sub, role: payload.role, email: payload.email },
        true,
      );

      // 캐시 재설정(refresh)
      await this.cacheManager.set(
        `REFRESH_TOKEN_${payload.sub}`,
        refreshToken,
        tokenAge.REFRESH_TOKEN_INT,
      );

      return {
        accessToken,
        refreshToken,
      };
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        throw new UnauthorizedException('만료된 토큰입니다');
      }
      throw e;
    }
  }

  async logout(userId: number) {
    await this.cacheManager.del(`REFRESH_TOKEN_${userId}`);
  }

  async revokeToken(userId: number) {
    const foundUser = await this.userService.findUserById(userId);

    // 캐시 삭제
    await this.cacheManager.del(`REFRESH_TOKEN_${foundUser.id}`);
  }

  hashPassword(password: string) {
    return bcrypt.hash(
      password,
      this.configService.get(envVariableKeys.hashRounds),
    );
  }

  async comparePassword(a: string, b: string) {
    const isCorrectPassword = await bcrypt.compare(a, b);
    if (!isCorrectPassword)
      throw new UnauthorizedException('잘못된 인증 정보입니다');
  }
}
