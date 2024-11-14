import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super();
  }

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const message = exception.message.replace(/\n/g, '');

    this.logger.error(exception.stack, null, PrismaClientExceptionFilter.name);

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        res.status(status).json({
          statusCode: status,
          error: 'Conflict',
          message: message.includes('title') ? '중복된 title 입니다' : message,
        });
        break;
      }
      default:
        // default 500 error code
        super.catch(exception, host);
        break;
    }
  }
}
