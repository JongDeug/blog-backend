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

    try {
      // 트랜잭션
      const transactionResult = await this.prismaService.$transaction(
        async (database) => {
          const { category, images, tags, ...restFields } = createPostDto;
          const deduplicatedTags = [...new Set(tags)];

          const newPost = await database.post.create({
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
                connectOrCreate: deduplicatedTags.map((name: string) => ({
                  where: { name },
                  create: { name },
                })),
              },
            },
          });

          return newPost;
        },
      );

      return transactionResult.id;
    } catch (e) {
      throw new InternalServerErrorException(e);
    }
  }

  findAll() {
    return `This action returns all post`;
  }

  findOne(id: number) {
    return `This action returns a #${id} post`;
  }

  update(id: number, updatePostDto: UpdatePostDto) {
    return `This action updates a #${id} post`;
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }
}
