import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // constructor() {
  //   super({
  //     omit: {
  //       user: {
  //         password: true,
  //       },
  //     },
  //   });
  // }

  async onModuleInit() {
    await this.$connect();
  }
}
