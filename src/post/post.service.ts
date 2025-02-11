import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { GetPostsDto } from './dto/get-posts.dto';
import { Image, Post, Prisma, User } from '@prisma/client';
import { TaskService } from 'src/common/task.service';
import { UserService } from '../user/user.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IMAGES_DIRECTORY_PATH, TEMP_DIRECTORY_PATH } from './const/path.const';

@Injectable()
export class PostService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async create(userId: number, createPostDto: CreatePostDto) {
    const foundUser = await this.userService.findUserById(userId);

    const newPost = await this.createPost(foundUser, createPostDto);

    try {
      // 이미지 파일 이동
      await this.taskService.moveFiles(
        TEMP_DIRECTORY_PATH,
        IMAGES_DIRECTORY_PATH,
        createPostDto.images,
      );
    } catch (e) {
      this.logger.error(e.stack, null, PostService.name);
      if (e.code === 'ENOENT') {
        e = new NotFoundException('요청 파일을 찾을 수 없습니다');
      }
      throw e;
    }

    return newPost.id;
  }

  async findAll(getPostsDto: GetPostsDto) {
    try {
      const { results, nextCursor } =
        await this.applyCursorPaginationToPost(getPostsDto);

      return {
        posts: results,
        cursor: nextCursor,
      };
    } catch (e) {
      this.logger.error(e.stack, null, PostService.name);
      throw e;
    }
  }

  async findOne(id: number, guestId: string, isEdit: boolean) {
    const [updatedPost] = await this.prismaService.$transaction([
      this.prismaService.post.update({
        where: { id },
        include: {
          comments: {
            where: { parentCommentId: null },
            orderBy: { createdAt: 'asc' },
            include: {
              childComments: {
                include: {
                  author: { omit: { password: true, role: true } },
                  guest: { omit: { password: true } },
                },
              },
              author: { omit: { password: true, role: true } },
              guest: { omit: { password: true } },
            },
          },
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
        data: isEdit
          ? {}
          : {
              views: { increment: 1 },
            },
      }),
    ]);

    // guestId 게시글 좋아요 확인
    const { postLikes, ...restFields } = updatedPost;
    const post = { ...restFields, isLiked: postLikes.length > 0 };

    return post;
  }

  async update(postId: number, userId: number, updatePostDto: UpdatePostDto) {
    const foundUser = await this.userService.findUserById(userId);

    const foundPost = await this.findPostWithImages(postId);

    // 작성자 비교
    if (foundUser.id !== foundPost.authorId) {
      throw new ForbiddenException('게시글에 대한 권한이 없습니다');
    }

    await this.updatePostWithTransaction(postId, updatePostDto);

    try {
      // 이미지 처리 (move, delete)
      await this.handleImageFiles(foundPost.images, updatePostDto.images);
    } catch (e) {
      this.logger.error(e.stack, null, PostService.name);
      if (e.code === 'ENOENT') {
        e = new NotFoundException('요청 파일을 찾을 수 없습니다');
      }
      throw e;
    }

    return foundPost.id;
  }

  async remove(id: number, userId: number) {
    const foundUser = await this.userService.findUserById(userId);

    const foundPost = await this.findPostWithImages(id);

    // 작성자 비교
    if (foundUser.id !== foundPost.authorId) {
      throw new ForbiddenException('게시글에 대한 권한이 없습니다');
    }

    await this.prismaService.post.delete({ where: { id } });

    try {
      // 이미지 파일 삭제
      if (foundPost.images.length > 0) {
        const filesToDelete = foundPost.images.map(
          (image: Image) => image.url.split(this.getImageURL())[1],
        );
        await this.taskService.deleteFiles(
          IMAGES_DIRECTORY_PATH,
          filesToDelete,
        );
      }
    } catch (e) {
      this.logger.error(e.stack, null, PostService.name);
      if (e.code === 'ENOENT') {
        e = new NotFoundException('요청 파일을 찾을 수 없습니다');
      }
      throw e;
    }
  }

  async togglePostLike(postId: number, guestId: string) {
    const foundPost = await this.findPostById(postId);

    const isLiked = await this.prismaService.postLike.findUnique({
      where: {
        postId_guestId: {
          postId: foundPost.id,
          guestId,
        },
      },
    });

    let likeIncrement = 0;

    // 좋아요 O -> 삭제
    // 좋아요 X -> 생성
    if (isLiked) {
      await this.prismaService.postLike.delete({
        where: { postId_guestId: { postId: foundPost.id, guestId } },
      });
      likeIncrement = -1;
    } else {
      await this.prismaService.postLike.create({
        data: {
          post: { connect: { id: foundPost.id } },
          guest: {
            connectOrCreate: { where: { guestId }, create: { guestId } },
          },
        },
      });
      likeIncrement = 1;
    }

    const foundPostLike = await this.prismaService.postLike.findUnique({
      where: { postId_guestId: { postId: foundPost.id, guestId } },
    });

    await this.prismaService.post.update({
      where: { id: foundPost.id },
      data: {
        likes: { increment: likeIncrement },
      },
    });

    return {
      isLiked: !!foundPostLike,
    };
  }

  // ====================================== Utils ======================================

  async applyCursorPaginationToPost(getPostsDto: GetPostsDto) {
    const { cursor, take, search, draft, category } = getPostsDto;

    const whereConditions = {
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { content: { contains: search } },
            ],
          }
        : {}),
      ...(category ? { category: { name: category } } : {}),
      draft,
    };

    let { order } = getPostsDto;
    let cursorCondition;

    if (cursor) {
      const result = this.parseCursorWithValidation(cursor);
      // cursor가 있을때 order 덮어쓰기
      order = result.order;
      cursorCondition = result.values;
    }

    const orderByCondition = this.parseOrderWithValidation(order);

    const results = await this.prismaService.post.findMany({
      where: whereConditions,
      orderBy: orderByCondition,
      include: { tags: true, images: true },
      skip: cursorCondition ? 1 : 0,
      take,
      cursor: cursorCondition ?? Prisma.skip,
    });

    // 다음 커서 생성
    const nextCursor = this.generateNextCursor<Post>(results, order);

    return {
      results,
      nextCursor,
    };
  }

  parseCursorWithValidation(cursor: string) {
    const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
    /**
     * {
     *  values: {
     *   id: 27,
     *  },
     *  order: ['id_desc'],
     * }
     */
    const { values, order } = JSON.parse(decodedCursor);

    // values 체킹
    for (const key of Object.keys(values)) {
      if (!(key in Prisma.PostScalarFieldEnum)) {
        throw new BadRequestException(
          `유효하지 않는 cursor 필드입니다 { values: { ${key} } }`,
        );
      }
    }

    return { values, order };
  }

  parseOrderWithValidation(order: string[]) {
    return order.map((item) => {
      const splitItem = item.split('_');

      if (splitItem.length !== 2) {
        throw new BadRequestException(
          `유효하지 않는 order: ${item} 입니다 ex) id_desc`,
        );
      }

      // eslint-disable-next-line prefer-const
      let [key, value] = splitItem;
      value = value.toLowerCase();

      if (!(key in Prisma.PostScalarFieldEnum)) {
        throw new BadRequestException(
          `유효하지 않는 order "${key}" key 입니다. 올바른 key를 입력해주세요`,
        );
      }

      if (!['desc', 'asc'].includes(value)) {
        throw new BadRequestException(
          `유효하지 않는 order "${value}" value 입니다. ex) desc, asc`,
        );
      }

      return { [key]: value };
    });
  }

  generateNextCursor<T>(results: T[], order: string[]): string | null {
    if (!results.length) return null;

    /**
     * {
     *  values : {
     *   id: 27
     *  },
     *  order: ["id_desc"]
     * }
     */

    const lastItem = results[results.length - 1];

    // create values field
    const values = {};
    order.forEach((item) => {
      const [key] = item.split('_');
      values[key] = lastItem[key];
    });

    const nextCursor = { values, order };
    const base64 = Buffer.from(JSON.stringify(nextCursor)).toString('base64');

    return base64;
  }

  /* istanbul ignore next */
  getImageURL() {
    return process.env.NODE_ENV === 'production'
      ? `${this.configService.get(envVariableKeys.serverOrigin)}/api/uploads/`
      : `${this.configService.get(envVariableKeys.serverOrigin)}/uploads/`;
  }

  /* istanbul ignore next */
  getBaseURL() {
    return new URL(this.getImageURL());
  }

  /* istanbul ignore next */
  createPost(user: User, createPostDto: CreatePostDto) {
    const { category, images, tags, ...restFields } = createPostDto;

    return this.prismaService.post.create({
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
              url: new URL(fileName, this.getBaseURL()).toString(),
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
  }

  /* istanbul ignore next */
  updatePostWithTransaction(postId: number, updatePostDto: UpdatePostDto) {
    const { images, tags, category, ...restFields } = updatePostDto;

    return this.prismaService.$transaction(async (database) => {
      // 게시글을 참조하고 있는 이미지 데이터베이스 삭제
      await database.image.deleteMany({
        where: { post: { id: postId } },
      });

      await database.post.update({
        where: { id: postId },
        data: {
          ...restFields,
          category: category
            ? {
                connectOrCreate: {
                  where: { name: category },
                  create: { name: category },
                },
              }
            : Prisma.skip,
          images: {
            createMany: {
              data: images.map((fileName: string) => ({
                url: new URL(fileName, this.getBaseURL()).toString(),
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
    });
  }

  async handleImageFiles(currentImages: Image[], incomingImages: string[]) {
    const oldImageArray: string[] = currentImages.map(
      (image: Image) => image.url.split(this.getImageURL())[1],
    );
    const oldImageSet: Set<string> = new Set(oldImageArray);
    const newImageArray: string[] = incomingImages;
    const newImageSet: Set<string> = new Set(newImageArray);

    const getDifference = (arr: string[], set: Set<string>) => {
      return arr.filter((fileName: string) => !set.has(fileName));
    };

    // 새롭게 들어온 놈을 골라 이동 (파일 이동)
    const imagesToMove = getDifference(newImageArray, oldImageSet);
    // 더 이상 쓰지 않는 놈을 골라 제거 (파일 삭제)
    const imagesToDelete = getDifference(oldImageArray, newImageSet);

    await Promise.all([
      await this.taskService.moveFiles(
        TEMP_DIRECTORY_PATH,
        IMAGES_DIRECTORY_PATH,
        imagesToMove,
      ),
      await this.taskService.deleteFiles(IMAGES_DIRECTORY_PATH, imagesToDelete),
    ]);
  }

  async findPostById(id: number) {
    const foundPost = await this.prismaService.post.findUnique({
      where: { id },
      // where: { id: id ?? Prisma.skip }, // findUnique에서는 Prisma.skip 작동 x
    });
    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

    return foundPost;
  }

  async findPostWithAuthor(id: number) {
    const foundPost = await this.prismaService.post.findUnique({
      where: { id },
      // where: { id: id ?? Prisma.skip }, // findUnique에서는 Prisma.skip 작동 x
      include: { author: true },
    });
    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

    return foundPost;
  }

  async findPostWithImages(id: number) {
    const foundPost = await this.prismaService.post.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!foundPost) throw new NotFoundException('게시글이 존재하지 않습니다');

    return foundPost;
  }

  async findPostWithDetails(id: number, guestId: string) {
    const foundPost = await this.prismaService.post.findUnique({
      where: { id },
      include: {
        comments: {
          where: { parentCommentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            childComments: {
              include: {
                author: { omit: { password: true, role: true } },
                guest: { omit: { password: true } },
              },
            },
            author: { omit: { password: true, role: true } },
            guest: { omit: { password: true } },
          },
        },
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

    return foundPost;
  }
}
