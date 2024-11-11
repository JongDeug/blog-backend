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
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { GetPostsDto } from './dto/get-posts.dto';
import { Image, Post, Prisma } from '@prisma/client';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import { TaskService } from 'src/common/task.service';

@Injectable()
export class PostService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly taskService: TaskService,
  ) {}

  async create(userId: number, createPostDto: CreatePostDto) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!foundUser) throw new NotFoundException('유저를 찾을 수 없습니다');

    const { category, images, tags, ...restFields } = createPostDto;
    const baseURL = new URL(
      `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
    );

    try {
      const newPost = await this.prismaService.post.create({
        data: {
          ...restFields,
          author: {
            connect: { id: foundUser.id },
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

      // 이미지 파일 이동
      await this.taskService.movieFiles(
        join(process.cwd(), 'public', 'temp'),
        join(process.cwd(), 'public', 'images'),
        images,
      );

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
    const foundPost = await this.prismaService.post.findUnique({
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
        postLikes: {
          where: {
            guestId, // unique
          },
        },
        _count: { select: { postLikes: true } },
      },
    });

    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

    const { postLikes, ...restFields } = foundPost;
    const post = { ...restFields, isLiked: postLikes.length > 0 };

    return post;
  }

  async update(postId: number, userId: number, updatePostDto: UpdatePostDto) {
    const foundUser = await this.prismaService.user.findUnique({
      where: { id: userId },
    });
    if (!foundUser) throw new NotFoundException('유저를 찾을 수 없습니다');

    const foundPost = await this.prismaService.post.findUnique({
      where: { id: postId },
      include: { images: true },
    });
    if (!foundPost) throw new NotFoundException('게시글을 찾을 수 없습니다');

    // 작성자 비교
    if (foundUser.id !== foundPost.authorId) {
      throw new ForbiddenException('게시글에 대한 권한이 없습니다');
    }

    const { images, tags, category, ...restFields } = updatePostDto;
    const baseURL = new URL(
      `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
    );

    try {
      const transactionResult = await this.prismaService.$transaction(
        async (database) => {
          // 게시글을 참조하고 있는 이미지 데이터베이스 삭제
          await database.image.deleteMany({
            where: { post: { id: postId } },
          });

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
        },
      );

      // 이미지 처리
      if (foundPost.images.length > 0) {
        const oldImageArray: string[] = foundPost.images.map(
          (image: Image) =>
            image.url.split(
              `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
            )[1],
        );
        const oldImageSet: Set<string> = new Set(oldImageArray);
        const newImageArray: string[] = images;
        const newImageSet: Set<string> = new Set(newImageArray);

        // 이미지 파일 이동
        // oldImage와 newImage를 비교해 새롭게 들어온 놈을 public/images 폴더로 이동
        const imagesToMove = newImageArray.filter(
          (fileName: string) => !oldImageSet.has(fileName),
        );
        await this.taskService.movieFiles(
          join(process.cwd(), 'public', 'temp'),
          join(process.cwd(), 'public', 'images'),
          imagesToMove,
        );

        // 이미지 파일 삭제
        // oldImage와 newImage를 비교해 더 이상 쓰이지 않는 oldImage를 public/images 폴더에서 제거
        const imagesToDelete = oldImageArray.filter(
          (fileName: string) => !newImageSet.has(fileName),
        );
        await this.taskService.deleteFiles(
          join(process.cwd(), 'public', 'images'),
          imagesToDelete,
        );
      }

      return transactionResult;
    } catch (e) {
      if (e.code === 'P2002' && e.meta.target.includes('title')) {
        throw new ConflictException('이미 존재하는 게시글의 title 입니다');
      }
      throw new InternalServerErrorException(e);
    }
  }

  async remove(id: number) {
    const foundPost = await this.prismaService.post.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

    await this.prismaService.post.delete({ where: { id } });

    // 이미지 파일 삭제
    if (foundPost.images.length > 0) {
      const filesToDelete = foundPost.images.map(
        (image: Image) =>
          image.url.split(
            `${this.configService.get(envVariableKeys.serverOrigin)}/public/images/`,
          )[1],
      );
      await this.taskService.deleteFiles(
        join(process.cwd(), 'public', 'images'),
        filesToDelete,
      );
    }
  }

  async togglePostLike(postId: number, guestId: string) {
    const foundPost = this.prismaService.post.findUnique({
      where: { id: postId },
    });
    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

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

    const foundPostLike = await this.prismaService.postLike.findUnique({
      where: { postId_guestId: { postId, guestId } },
    });

    return {
      isLiked: !!foundPostLike,
    };
  }

  // ====================================== Utils ======================================

  async applyCursorPaginationToPost(
    dto: CursorPaginationDto,
    whereCondition: Prisma.PostWhereInput,
  ) {
    const { cursor, take } = dto;
    let { order } = dto;
    let cursorCondition;

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

    const orderByCondition = this.parseOrder(order);

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
  parseOrder(order: string[]) {
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
      const [key] = item.split('_'); // key_value
      values[key] = lastItem[key];
    });

    const nextCursor = { values, order };
    const base64 = Buffer.from(JSON.stringify(nextCursor)).toString('base64');

    return base64;
  }
}
