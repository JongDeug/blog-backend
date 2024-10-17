import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { RegisterDto } from './dto/register.dto';
import { excludeFromObject } from 'src/prisma/util/exclude.util';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  async register(registerDto: RegisterDto) {
    // 유저 검색
    const user = await this.prismaService.user.findUnique({
      where: { email: registerDto.email },
    });

    if (user) {
      throw new ConflictException('이미 가입한 이메일입니다');
    }

    // 비밀번호 해시
    const hash = await bcrypt.hash(
      registerDto.password,
      this.configService.get(envVariableKeys.hashRounds),
    );

    // 유저 생성
    const newUser = await this.prismaService.user.create({
      data: {
        ...registerDto,
        password: hash,
      },
    });

    return excludeFromObject(newUser, ['password']);
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

    if (splitDecodedBase64.length !== 2) {
      throw new BadRequestException('토큰 포맷이 잘못됐습니다');
    }

    return {
      email,
      password,
    };
  }

  async login(rawToken: string) {
    const { email, password } = this.parseBasicToken(rawToken);

    // 인증
    const user = await this.authenticate(email, password);

    // 토큰 발급
    return {
      accessToken: await this.issueToken(user, false),
      refreshToken: await this.issueToken(user, true),
    };
  }

  async authenticate(email: string, password: string) {
    // 유저 검색
    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('가입되지 않은 이메일입니다');
    }

    // 비밀번호 확인
    const isCorrect = await bcrypt.compare(password, user.password);

    if (!isCorrect) {
      throw new BadRequestException('잘못된 로그인 정보입니다');
    }

    return user;
  }

  async issueToken(payload: { id: string; role: Role }, isRefresh: boolean) {
    const accessTokenSecret = this.configService.get(
      envVariableKeys.accessTokenSecret,
    );
    const refreshTokenSecret = this.configService.get(
      envVariableKeys.refresTokenSecret,
    );

    return this.jwtService.signAsync(
      {
        sub: payload.id,
        role: payload.role,
        type: isRefresh ? 'refresh' : 'access',
      },
      {
        secret: isRefresh ? refreshTokenSecret : accessTokenSecret,
        expiresIn: isRefresh ? '24h' : 180,
      },
    );
  }
}
