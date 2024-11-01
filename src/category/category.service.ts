import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const isExist = await this.prismaService.category.findUnique({
      where: { name: createCategoryDto.name },
    });

    if (isExist) {
      throw new ConflictException('이미 존재하는 카테고리입니다');
    }

    const newCategory = await this.prismaService.category.create({
      data: {
        name: createCategoryDto.name,
      },
    });

    return newCategory;
  }

  findAll() {
    return this.prismaService.category.findMany({
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!category) {
      throw new NotFoundException('카테고리가 존재하지 않습니다');
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    // 카테고리 검색
    const category = await this.prismaService.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('카테고리가 존재하지 않습니다');
    }

    // 업데이트하려는 카테고리 검색
    const isExist = await this.prismaService.category.findUnique({
      where: { name: updateCategoryDto.name },
    });
    if (isExist) {
      throw new ConflictException('이미 존재하는 카테고리입니다');
    }

    // 카테고리 업데이트
    const newCategory = await this.prismaService.category.update({
      where: { id },
      data: {
        name: updateCategoryDto.name,
      },
    });

    return newCategory;
  }

  async remove(id: number) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      include: { posts: true },
    });

    if (!category) {
      throw new NotFoundException('카테고리가 존재하지 않습니다');
    }

    // onDelete: Restrict (게시글 many 쪽에서 설정)
    if (category.posts.length > 0) {
      throw new BadRequestException(
        '카테고리를 참조하고 있는 게시글이 있습니다',
      );
    }

    await this.prismaService.category.delete({ where: { id } });
  }
}
