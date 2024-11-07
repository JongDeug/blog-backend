import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      omit: {
        category: {
          createdAt: true,
          updatedAt: true,
        },
      },
      // log: [
      //   {
      //     emit: 'event',
      //     level: 'query',
      //   },
      // ],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
