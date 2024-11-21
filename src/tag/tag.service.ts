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
    // 이미 존재하는 태그인지 확인
    await this.findTagByName(createTagDto.name);

    const newTag = await this.prismaService.tag.create({
      data: { name: createTagDto.name },
    });

    return newTag;
  }

  findAll() {
    return this.prismaService.tag.findMany({});
  }

  async findTagById(id: number) {
    const foundTag = await this.prismaService.tag.findUnique({
      where: { id },
      include: { posts: true },
    });
    if (!foundTag) throw new NotFoundException('존재하지 않는 태그입니다');

    return foundTag;
  }

  async update(id: number, updateTagDto: UpdateTagDto) {
    const foundTag = await this.findTagById(id);

    // 업데이트 하려는 태그가 존재하는지 확인
    await this.findTagByName(updateTagDto.name);

    // 태그 업데이트
    await this.prismaService.tag.update({
      where: { id: foundTag.id },
      data: {
        name: updateTagDto.name,
      },
    });
  }

  async remove(id: number) {
    const foundTag = await this.findTagById(id);

    if (foundTag.posts.length > 0) {
      throw new BadRequestException('태그를 참조하고 있는 게시글이 있습니다');
    }

    await this.prismaService.tag.delete({ where: { id } });
  }

  async findTagByName(name: string) {
    const foundTag = await this.prismaService.tag.findUnique({
      where: { name },
    });
    if (foundTag) throw new ConflictException('이미 존재하는 태그입니다');
  }
}
