import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class GoogleAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // to-google에서 query 추출 (request에서 추출)
    // response cookie에 저장?

    // const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    response.cookie('sex', 'sdfsdf');

    const result = (await super.canActivate(context)) as boolean;

    // google validate() 후 여기로 옴.
    const request = context.switchToHttp().getRequest();
    console.log(request);

    // /auth/to-google (X), /auth/google (O)
    // const request = context.switchToHttp().getRequest();

    return result;
  }
}
