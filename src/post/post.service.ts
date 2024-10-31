import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PostService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(userId: number, createPostDto: CreatePostDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const { category, images, tags, ...restFields } = createPostDto;

    try {
      const newPost = await this.prismaService.post.create({
        data: {
          ...restFields,
          author: {
            connect: { id: user.id },
          },
          category: {
            connectOrCreate: {
              where: { name: category },
              create: { name: category },
            },
          },
          images: {
            createMany: {
              data: images.map((url) => ({ url })),
            },
          },
          // Implicit Many To Many
          // https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations
          tags: {
            connectOrCreate: tags.map((name: string) => ({
              where: { name },
              create: { name },
            })),
          },
        },
      });

      return newPost.id;
    } catch (e) {
      throw new InternalServerErrorException(`Prisma ORM 에러: ${e.code}`);
    }
  }

  findAll() {
    return `This action returns all post`;
  }

  findOne(id: number) {
    return `This action returns a #${id} post`;
  }

  update(id: number, userId: number, updatePostDto: UpdatePostDto) {
    // user 확인
    // post.user 확인
    // 비교

    // update 하면됨
    return `This action updates a #${id} post`;
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }
}
