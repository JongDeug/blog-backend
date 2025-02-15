import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { UserService } from '../../user/user.service';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      clientID: configService.get(envVariableKeys.googleClientId),
      clientSecret: configService.get(envVariableKeys.googleClientSecret),
      callbackURL:
        process.env.NODE_ENV === 'production'
          ? `${configService.get(envVariableKeys.serverOrigin)}/api/nest/auth/google`
          : `${configService.get(envVariableKeys.serverOrigin)}/auth/google`,
      scope: ['email', 'profile'],
    });
  }

  // 구글에서 로그인이 실패했다면 validate 함수 자체가 실행되지 않음.
  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    const { id, name, emails } = profile;

    const providerId = id;
    const email = emails[0].value;
    const username = `${name.familyName}${name.givenName}`;

    const user = await this.userService.findUserByEmailOrCreate(
      email,
      username,
      providerId,
    );

    return user;
  }
}
