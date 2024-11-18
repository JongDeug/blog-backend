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
    const foundUser = await this.findUserWithoutPassword(id);

    return foundUser;
  }

  async remove(id: number) {
    const foundUser = await this.findUserById(id);

    await this.prismaService.user.delete({ where: { id: foundUser.id } });
  }

  async findUserById(id: number) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
    });
    if (!foundUser) throw new NotFoundException('사용자가 존재하지 않습니다');

    return foundUser;
  }

  async findUserWithoutPassword(id: number) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!foundUser) throw new NotFoundException('사용자가 존재하지 않습니다');

    return foundUser;
  }

  async findUserByEmail(email: string) {
    return this.prismaService.user.findUnique({ where: { email } });
  }
}
