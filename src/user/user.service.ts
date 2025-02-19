import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
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

  async findUserWithoutPassword(id: number) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!foundUser) throw new NotFoundException('사용자가 존재하지 않습니다');

    return foundUser;
  }

  async remove(id: number) {
    const foundUser = await this.findUserById(id);

    if (foundUser.role === Role.ADMIN) {
      throw new BadRequestException('관리자는 삭제할 수 없습니다');
    }

    await this.prismaService.user.delete({ where: { id: foundUser.id } });
  }

  async findUserById(id: number) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id },
    });
    if (!foundUser) throw new NotFoundException('사용자가 존재하지 않습니다');

    return foundUser;
  }

  findUserByEmail(email: string) {
    return this.prismaService.user.findUnique({ where: { email } });
  }

  async findUserByEmailOrCreate(
    email: string,
    name: string,
    providerId: string,
  ) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { email },
    });
    if (foundUser) return foundUser;

    const newUser = await this.prismaService.user.create({
      data: { email, name, providerId },
      omit: { password: true },
    });

    return newUser;
  }
}
