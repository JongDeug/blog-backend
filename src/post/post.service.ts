import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { rename } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { unlink } from 'fs/promises';
import { GetPostsDto } from './dto/get-posts.dto';
import { Post, PostLike, Prisma } from '@prisma/client';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';

@Injectable()
export class PostService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: number, createPostDto: CreatePostDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const { category, images, tags, ...restFields } = createPostDto;
    const baseURL = new URL(
      `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
    );

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
              data: images.map((fileName: string) => ({
                url: new URL(fileName, baseURL).toString(),
              })),
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
        throw new ConflictException('이미 존재하는 게시글의 title 입니다');
      }
      throw new InternalServerErrorException(e);
    }
  }

  async findAll(getPostsDto: GetPostsDto) {
    const { search, draft } = getPostsDto;

    const whereCondition = {
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { content: { contains: search } },
            ],
          }
        : {}),
      draft,
    };

    const { results, nextCursor } = await this.applyCursorPaginationToPost(
      getPostsDto,
      whereCondition,
    );

    return {
      posts: results,
      cursor: nextCursor,
    };
  }

  async findOne(id: number, guestId: string) {
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
        postLikes: true,
      },
    });

    if (!post) throw new NotFoundException('게시글이 존재하지 않습니다');

    const isLiked = post.postLikes.some(
      (postLike: PostLike) => guestId === postLike.guestId,
    );

    return {
      post,
      isLiked,
    };
  }

  async update(postId: number, userId: number, updatePostDto: UpdatePostDto) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const post = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // 작성자 비교
    if (user.id !== post.authorId) {
      throw new ForbiddenException('게시글에 대한 권한이 없습니다');
    }

    const { images, tags, category, ...restFields } = updatePostDto;
    const baseURL = new URL(
      `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
    );

    try {
      // 트랜잭션으로 묶음
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
                data: images.map((fileName: string) => ({
                  url: new URL(fileName, baseURL).toString(),
                })),
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

      if (post.images.length > 0) {
        // fileName 분리
        const existingImages: string[] = post.images.map(
          (obj) =>
            obj.url.split(
              `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
            )[1],
        );
        const existingImagesSet: Set<string> = new Set(existingImages);
        const newImages: string[] = images;
        const newImagesSet: Set<string> = new Set(newImages);

        // updatePostDto.images 중 새롭게 temp에 들어온 놈 images로 이동
        const imagesToMove = newImages.filter(
          (fileName: string) => !existingImagesSet.has(fileName),
        );
        await this.movieFiles(imagesToMove);

        // 기존에 있던 놈 vs 새로운 놈 -> 기존에 있는 놈 중 쓰이지 않으면 images 폴더에서 제거
        const imagesToDelete = existingImages.filter(
          (fileName: string) => !newImagesSet.has(fileName),
        );
        await this.deleteFiles(imagesToDelete);
      }

      return result;
    } catch (e) {
      if (e.code === 'P2002' && e.meta.target.includes('title')) {
        throw new ConflictException('이미 존재하는 게시글의 title 입니다');
      }
      throw new InternalServerErrorException(e);
    }
  }

  async remove(id: number) {
    // 게시글 찾기
    const post = await this.prismaService.post.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!post) {
      throw new NotFoundException('게시글이 존재하지 않습니다');
    }

    await this.prismaService.post.delete({ where: { id } });

    // 이미지 삭제
    if (post.images.length > 0) {
      const filesToDelete = post.images.map(
        (obj) =>
          obj.url.split(
            `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
          )[1],
      );
      await this.deleteFiles(filesToDelete);
    }
  }

  async togglePostLike(postId: number, guestId: string) {
    const post = this.prismaService.post.findUnique({
      where: { id: postId },
    });

    if (!post) throw new NotFoundException('게시글이 존재하지 않습니다');

    const isLiked = await this.prismaService.postLike.findUnique({
      where: {
        postId_guestId: {
          postId,
          guestId,
        },
      },
    });

    // 좋아요 O -> 삭제
    // 좋아요 X -> 생성
    if (isLiked) {
      await this.prismaService.postLike.delete({
        where: { postId_guestId: { postId, guestId } },
      });
    } else {
      await this.prismaService.postLike.create({
        data: {
          post: { connect: { id: postId } },
          guest: {
            connectOrCreate: { where: { guestId }, create: { guestId } },
          },
        },
      });
    }

    const result = await this.prismaService.postLike.findUnique({
      where: { postId_guestId: { postId, guestId } },
    });

    return {
      isLiked: !!result,
    };
  }

  // ====================================== Utils ======================================

  async movieFiles(files: string[]) {
    const tempFolder = join('public', 'temp');
    const imageFolder = join('public', 'images');

    try {
      // 폴더 없으면 생성
      await mkdir(imageFolder, { recursive: true });

      // 폴더 이동
      const renamePromises = files.map((fileName: string) => {
        return rename(
          join(process.cwd(), tempFolder, fileName),
          join(process.cwd(), imageFolder, fileName),
        );
      });
      await Promise.all(renamePromises);
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  async deleteFiles(files: string[]) {
    const imageFolder = join(process.cwd(), 'public', 'images');

    try {
      const deletePromises = files.map((fileName: string) => {
        return unlink(join(imageFolder, fileName));
      });

      await Promise.all(deletePromises);
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  async applyCursorPaginationToPost(
    dto: CursorPaginationDto,
    whereCondition: Prisma.PostWhereInput,
  ) {
    let { cursor, order, take } = dto;
    let cursorCondition;
    let orderByCondition;

    if (cursor) {
      /**
       * {
       *  values: {
       *   id: 27,
       *  },
       *  order: ['id_desc'],
       * }
       */
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      const cursorObj = JSON.parse(decodedCursor);
      // values 적용
      cursorCondition = cursorObj.values;
      // order 덮어쓰기
      order = cursorObj.order;
    }

    orderByCondition = this.parseOrder(order);

    const results = await this.prismaService.post.findMany({
      where: whereCondition,
      orderBy: orderByCondition,
      skip: cursorCondition ? 1 : 0,
      take,
      cursor: cursorCondition,
    });

    // 다음 커서 생성
    const nextCursor = this.generateNextCursor<Post>(results, order);

    return {
      results,
      nextCursor,
    };
  }

  // order 파싱
  parseOrder(order: string[]): {} {
    return Object.fromEntries(
      order.map((item) => {
        return item.split('_');
      }),
    );
  }

  // 커서를 생성하는 함수
  generateNextCursor<T>(results: T[], order: string[]): string | null {
    if (!results.length) return null;
    /**
     * {
     *  values : {
     *   id: 27
     *  },
     *  order: ["id_DESC"]
     * }
     */

    const lastItem = results[results.length - 1];

    // create values
    const values = {};
    order.forEach((item) => {
      const [key, _] = item.split('_');
      values[key] = lastItem[key];
    });

    const nextCursor = { values, order };
    const base64 = Buffer.from(JSON.stringify(nextCursor)).toString('base64');

    return base64;
  }
}
