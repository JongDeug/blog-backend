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
    // 이미 존재하는 카테고리인지 확인
    await this.findCategoryByName(createCategoryDto.name);

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

  findOne(id: number) {
    return this.findCategoryById(id);
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    const foundCategory = await this.findCategoryById(id);

    // 업데이트 하려는 카테고리가 존재하는지 확인
    await this.findCategoryByName(updateCategoryDto.name);

    // 카테고리 업데이트
    const newCategory = await this.prismaService.category.update({
      where: { id: foundCategory.id },
      data: {
        name: updateCategoryDto.name,
      },
    });

    return newCategory;
  }

  async remove(id: number) {
    const foundCategory = await this.findCategoryById(id);

    // DB 설정 해놓긴 함. Post.category: (onDelete: Restrict)
    if (foundCategory.posts.length > 0) {
      throw new BadRequestException(
        '카테고리를 참조하고 있는 게시글이 있습니다',
      );
    }

    await this.prismaService.category.delete({ where: { id } });
  }

  async findCategoryById(id: number) {
    const foundCategory = await this.prismaService.category.findUnique({
      where: { id },
      include: { posts: true },
    });
    if (!foundCategory)
      throw new NotFoundException('존재하지 않는 카테고리입니다');

    return foundCategory;
  }

  async findCategoryByName(name: string) {
    const foundCategory = await this.prismaService.category.findUnique({
      where: { name },
    });
    if (foundCategory)
      throw new ConflictException('이미 존재하는 카테고리입니다');
  }
}
