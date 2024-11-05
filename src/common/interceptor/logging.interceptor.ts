import {
  CallHandler,
  ExecutionContext,
  Inject,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const { ip, method, path, headers } = req;

    const requestTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now();
        const duration = responseTime - requestTime;

        this.logger.log(
          `[${method}] ${path} ${duration}ms ${ip} ${headers['user-agent']}`,
          LoggingInterceptor.name,
        );
      }),
    );
  }
}
