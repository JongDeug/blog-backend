import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  findAll() {
    return this.prismaService.user.findMany({
      omit: {
        password: true,
      },
    });
  }

  async findOne(id: number) {
    const foundUser = await this.findUserWithNotFoundException(
      { id },
      '존재하지 않는 사용자입니다',
      { password: true },
    );

    return foundUser;
  }

  async remove(id: number) {
    await this.findUserWithNotFoundException(
      { id },
      '존재하지 않는 사용자입니다',
    );

    await this.prismaService.user.delete({ where: { id } });
  }

  async findUserWithNotFoundException(
    whereCondition: Prisma.UserWhereUniqueInput,
    errorMessage: string,
    omitCondition: Prisma.UserOmit = {},
  ) {
    const foundUser = await this.prismaService.user.findUnique({
      where: whereCondition,
      omit: omitCondition,
    });
    if (!foundUser) throw new NotFoundException(errorMessage);

    return foundUser;
  }
}
