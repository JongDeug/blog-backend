import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { rename } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

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
            // 연결 및 생성이기 때문에 중복 생성 걱정 x
            connectOrCreate: tags.map((name: string) => ({
              where: { name },
              create: { name },
            })),
          },
        },
      });
      // 이미지 이동 temp -> images
      await this.movieFiles(images);

      return newPost.id;
    } catch (e) {
      if (e.code === 'P2002' && e.meta.target.includes('title')) {
        throw new ConflictException('이미 존재하는 게시글 title 입니다');
      }
      throw new InternalServerErrorException(e);
    }
  }

  async movieFiles(images: string[]) {
    const tempFolder = join('public', 'temp');
    const imageFolder = join('public', 'images');

    // 폴더 없으면 생성
    await mkdir(imageFolder, { recursive: true });

    // 폴더 이동
    const renamePromises = images.map((fileName: string) => {
      return rename(
        join(process.cwd(), tempFolder, fileName),
        join(process.cwd(), imageFolder, fileName),
      );
    });
    await Promise.all(renamePromises);
  }

  findAll() {
    return `This action returns all post`;
  }

  async findOne(id: number) {
    const post = await this.prismaService.post.findUnique({
      where: { id },
      include: {
        comments: true,
        category: true,
        tags: true,
        images: {
          omit: { postId: true },
        },
        author: {
          omit: {
            password: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!post) throw new NotFoundException('게시글이 존재하지 않습니다');

    return post;
  }

  async update(postId: number, userId: number, updatePostDto: UpdatePostDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { tags: true },
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // 작성자 비교
    if (user.id !== post.authorId) {
      throw new ForbiddenException('게시글에 대한 권한이 없습니다');
    }

    const { images, tags, category, ...restFields } = updatePostDto;

    try {
      // 트랜잭션
      const result = await this.prismaService.$transaction(async (database) => {
        // 게시글을 참조하고 있는 이미지 정보 삭제
        await database.image.deleteMany({
          where: { post: { id: postId } },
        });

        // 게시글 업데이트
        const newPost = await database.post.update({
          where: { id: postId },
          data: {
            ...restFields,
            category: {
              connectOrCreate: {
                where: { name: category },
                create: { name: category },
              },
            },
            images: {
              createMany: {
                data: images.map((url: string) => ({ url })),
              },
            },
            tags: {
              // 연결 및 생성 => 이걸 바탕으로 관계 덮어쓰기(set)
              connectOrCreate: tags.map((name: string) => ({
                where: { name },
                create: { name },
              })),
              set: tags.map((name: string) => ({ name })),
            },
          },
          include: { tags: true, images: true },
        });

        return newPost;
      });

      // 업데이트할 때 새롭게 들어온 이미지만 이동 temp -> images
      // 기존에 있던 놈과 새로운놈이랑 비교해서 쓰이지 않는 놈은 제거 (images 폴더에서 제거)
      // await this.movieFiles(images);

      return result;
    } catch (e) {
      throw new InternalServerErrorException(`Prisma ORM 에러: ${e.code}`);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} post`;
  }
}
