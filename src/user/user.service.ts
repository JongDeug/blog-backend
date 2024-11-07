import { Injectable, NotFoundException } from '@nestjs/common';
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
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!foundUser) throw new NotFoundException('존재하지 않는 사용자입니다');

    return foundUser;
  }

  async remove(id: number) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
    });
    if (!foundUser) throw new NotFoundException('존재하지 않는 사용자입니다');

    await this.prismaService.user.delete({ where: { id } });
  }
}
