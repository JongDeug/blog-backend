import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TagService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createTagDto: CreateTagDto) {
    const isExist = await this.prismaService.tag.findUnique({
      where: { name: createTagDto.name },
    });

    if (isExist) throw new ConflictException('이미 존재하는 태그입니다');

    const newTag = await this.prismaService.tag.create({
      data: { name: createTagDto.name },
    });

    return newTag;
  }

  findAll() {
    return this.prismaService.tag.findMany({});
  }

  findOne(id: number) {
    const tag = this.prismaService.tag.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!tag) {
      throw new NotFoundException('존재하지 않는 태그입니다');
    }

    return tag;
  }

  async update(id: number, updateTagDto: UpdateTagDto) {
    // 태그 검색
    const tag = await this.prismaService.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('존재하지 않는 태그입니다');

    // 업데이트 하려는 태그 검색
    const isExist = await this.prismaService.tag.findUnique({
      where: { name: updateTagDto.name },
    });
    if (isExist) throw new ConflictException('이미 존재하는 태그입니다');

    // 태그 업데이트
    const newTag = await this.prismaService.tag.update({
      where: { id },
      data: {
        name: updateTagDto.name,
      },
    });

    return newTag;
  }

  async remove(id: number) {
    const tag = await this.prismaService.tag.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!tag) throw new NotFoundException('존재하지 않는 태그입니다');

    if (tag.posts.length > 0) {
      throw new BadRequestException('태그를 참조하고 있는 게시글이 있습니다');
    }

    await this.prismaService.tag.delete({ where: { id } });
  }
}
