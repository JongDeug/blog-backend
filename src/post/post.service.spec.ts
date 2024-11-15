import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';
import {
  Post,
  PostLike,
  Prisma,
  PrismaClient,
  User,
  Image,
} from '@prisma/client';
import { TaskService } from 'src/common/task.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UserService } from 'src/user/user.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { GetPostsDto } from './dto/get-posts.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IMAGES_DIRECTORY_PATH, TEMP_DIRECTORY_PATH } from './const/path.const';
import { UpdatePostDto } from './dto/update-post.dto';
import { CursorPaginationDto } from './dto/cursor-pagination.dto';
import { NotFoundError } from 'rxjs';

describe('PostService', () => {
  let postService: PostService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let configService: MockProxy<ConfigService>;
  let taskService: MockProxy<TaskService>;
  let userService: MockProxy<UserService>;
  let logger: MockProxy<LoggerService>;

  type PostType = Prisma.PromiseReturnType<
    typeof postService.findPostWithNotFoundException
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: TaskService, useValue: mock<TaskService>() },
        { provide: UserService, useValue: mock<UserService>() },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: mock<LoggerService>(),
        },
      ],
    }).compile();

    postService = module.get<PostService>(PostService);
    prismaMock = module.get(PrismaService);
    configService = module.get(ConfigService);
    taskService = module.get(TaskService);
    userService = module.get(UserService);
    logger = module.get(WINSTON_MODULE_NEST_PROVIDER);
  });

  it('should be defined', () => {
    expect(postService).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    it('should create a post', async () => {
      const userId = 1;
      const foundUser = { id: userId } as User;
      const createPostDto = new CreatePostDto();
      createPostDto.title = '게시글 제목';
      createPostDto.content = '게시글 내용';
      createPostDto.draft = false;
      createPostDto.summary = '게시글 요약';
      createPostDto.category = '리눅스';
      const newPost = { id: 1 } as Post;

      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);
      jest.spyOn(postService, 'createPost').mockResolvedValue(newPost);

      const result = await postService.create(userId, createPostDto);

      expect(result).toEqual(newPost.id);
      expect(userService.findUserWithNotFoundException).toHaveBeenCalledWith(
        { id: userId },
        '유저를 찾을 수 없습니다',
      );
      expect(postService.createPost).toHaveBeenCalledWith(
        foundUser,
        createPostDto,
      );
      expect(taskService.moveFiles).toHaveBeenCalledWith(
        TEMP_DIRECTORY_PATH,
        IMAGES_DIRECTORY_PATH,
        expect.any(Array),
      );
    });

    it('should throw a NotFoundException if requested files do not exist', async () => {
      const userId = 1;
      const foundUser = { id: userId } as User;
      const createPostDto = new CreatePostDto();
      const newPost = { id: 1 } as Post;

      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);
      jest.spyOn(postService, 'createPost').mockResolvedValue(newPost);
      jest
        .spyOn(taskService, 'moveFiles')
        .mockRejectedValue({ code: 'ENOENT' });

      await expect(postService.create(userId, createPostDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.findUserWithNotFoundException).toHaveBeenCalled();
      expect(taskService.moveFiles).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of posts with cursor-based pagination', async () => {
      const getPostsDto = new GetPostsDto();
      getPostsDto.search = 'search word';
      getPostsDto.cursor =
        'eyJ2YWx1ZXMiOnsiaWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';
      const results = [{ id: 1 }] as Post[];
      const nextCursor =
        'eyJYWx1Z12l3j1231lk23j12l3k1j23sdfjadsflksjflskfjdlfkjsf=';

      jest
        .spyOn(postService, 'applyCursorPaginationToPost')
        .mockResolvedValue({ results, nextCursor });

      const result = await postService.findAll(getPostsDto);

      expect(result).toEqual({ posts: results, cursor: nextCursor });
      expect(postService.applyCursorPaginationToPost).toHaveBeenCalledWith(
        getPostsDto,
        {
          OR: [
            { title: { contains: getPostsDto.search } },
            { content: { contains: getPostsDto.search } },
          ],
          draft: getPostsDto.draft,
        },
      );
    });

    it('should throw a BadRequestException if cursor or order fields are invalid', async () => {
      const getPostsDto = new GetPostsDto();
      getPostsDto.cursor = 'invalidcursor';

      jest
        .spyOn(postService, 'applyCursorPaginationToPost')
        .mockRejectedValue(new BadRequestException());

      await expect(postService.findAll(getPostsDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(postService.applyCursorPaginationToPost).toHaveBeenCalled();
    });

    // it('should throw an InternalServerErrorException when postService.applyCursorPaginationToPost() fails', async () => {
    //   const getPostsDto = new GetPostsDto();
    //   getPostsDto.cursor =
    //     'eyJ2YWx1ZXMiOnsiaWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0';

    //   jest
    //     .spyOn(postService, 'applyCursorPaginationToPost')
    //     .mockRejectedValue(Error);

    //   await expect(postService.findAll(getPostsDto)).rejects.toThrow(
    //     ,
    //   );
    //   expect(postService.applyCursorPaginationToPost).toHaveBeenCalled();
    // });
  });

  describe('findOne', () => {
    it('should return a post with isLiked field', async () => {
      const id = 1;
      const guestId = 'uuid';
      const foundPost = {
        id: 1,
        postLikes: [{ guestId }],
      } as PostType;
      const post = {
        id: foundPost.id,
        isLiked: foundPost.postLikes.length > 0,
      };

      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);

      const result = await postService.findOne(id, guestId);

      expect(result).toEqual(post);
      expect(postService.findPostWithNotFoundException).toHaveBeenCalledWith(
        { id },
        '게시글이 존재하지 않습니다',
        expect.any(Object),
      );
    });
  });

  describe('update', () => {
    let mockUpdatePostWithTransaction: jest.SpyInstance;
    let mockHandleImageFiles: jest.SpyInstance;
    let postId, userId, updatePostDto, foundUser, foundPost;

    beforeEach(() => {
      postId = 10;
      userId = 1;
      updatePostDto = new UpdatePostDto();
      updatePostDto.title = '제목 수정';
      foundUser = { id: userId, email: 'test@gmail.com' } as User;
      foundPost = {
        id: postId,
        authorId: userId,
        images: [],
      } as PostType;

      mockUpdatePostWithTransaction = jest.spyOn(
        postService,
        'updatePostWithTransaction',
      );
      mockHandleImageFiles = jest.spyOn(postService, 'handleImageFiles');
    });

    it('should update a post and handle image files (move, delete)', async () => {
      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);

      await postService.update(postId, userId, updatePostDto);

      expect(userService.findUserWithNotFoundException).toHaveBeenCalledWith(
        { id: userId },
        '유저를 찾을 수 없습니다',
      );
      expect(postService.findPostWithNotFoundException).toHaveBeenCalledWith(
        { id: postId },
        '게시글이 존재하지 않습니다',
        { images: true },
      );
      expect(mockUpdatePostWithTransaction).toHaveBeenCalledWith(
        postId,
        updatePostDto,
      );
      expect(mockHandleImageFiles).toHaveBeenCalledWith(
        foundPost.images,
        updatePostDto.images,
      );
    });

    it('should throw a ForbiddenException if the user is not the author of the post', async () => {
      const foundPost = {
        id: postId,
        authorId: 999999999,
        images: [],
      } as PostType;

      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(ForbiddenException);
      expect(userService.findUserWithNotFoundException).toHaveBeenCalled();
      expect(postService.findPostWithNotFoundException).toHaveBeenCalled();
      expect(mockUpdatePostWithTransaction).not.toHaveBeenCalled();
    });

    it('should throw a NotFoundException if requested files do not exist', async () => {
      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);
      mockHandleImageFiles.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(NotFoundException);
      expect(userService.findUserWithNotFoundException).toHaveBeenCalled();
      expect(postService.findPostWithNotFoundException).toHaveBeenCalled();
      expect(mockUpdatePostWithTransaction).toHaveBeenCalled();
      expect(mockHandleImageFiles).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a post with all its relations (comments, images, postLikes)', async () => {
      const id = 1;
      const serverOrigin = 'https://test.org';
      const foundPost = {
        id,
        title: '제목',
        images: [
          {
            url: `${serverOrigin}/public/images/aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png`,
          },
        ],
      } as PostType;

      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);
      jest.spyOn(configService, 'get').mockReturnValue(serverOrigin);

      await postService.remove(id);

      expect(postService.findPostWithNotFoundException).toHaveBeenCalledWith(
        { id },
        '게시글이 존재하지 않습니다',
        { images: true },
      );
      expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id } });
      expect(taskService.deleteFiles).toHaveBeenCalledWith(
        IMAGES_DIRECTORY_PATH,
        ['aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png'],
      );
    });

    it('should throw a NotFoundException if requested files do not exist', async () => {
      const id = 1;
      const serverOrigin = 'https://test.org';
      const foundPost = {
        id,
        title: '제목',
        images: [
          {
            url: `${serverOrigin}/public/images/aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png`,
          },
        ],
      } as PostType;

      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);
      jest.spyOn(configService, 'get').mockReturnValue(serverOrigin);
      jest
        .spyOn(taskService, 'deleteFiles')
        .mockRejectedValue({ code: 'ENOENT' });

      await expect(postService.remove(id)).rejects.toThrow(NotFoundException);
      expect(postService.findPostWithNotFoundException).toHaveBeenCalled();
      expect(prismaMock.post.delete).toHaveBeenCalled();
      expect(taskService.deleteFiles).toHaveBeenCalled();
    });
  });

  describe('togglePostLike', () => {
    it('should add a like on the post like', async () => {
      const postId = 1;
      const guestId = 'uuid';
      const foundPost = { id: postId } as PostType;
      const isLiked = null;
      const foundPostLike = { postId, guestId } as PostLike;

      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(isLiked);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(foundPostLike);

      const result = await postService.togglePostLike(postId, guestId);

      expect(result).toEqual({ isLiked: !!foundPostLike });
      expect(postService.findPostWithNotFoundException).toHaveBeenCalledWith(
        { id: postId },
        '게시글이 존재하지 않습니다',
      );
      expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
        where: {
          postId_guestId: {
            postId,
            guestId,
          },
        },
      });
      expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
      expect(prismaMock.postLike.create).toHaveBeenCalledWith({
        data: {
          post: { connect: { id: postId } },
          guest: {
            connectOrCreate: { where: { guestId }, create: { guestId } },
          },
        },
      });
      expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
        where: { postId_guestId: { postId, guestId } },
      });
    });

    it('should remove a like on the post like', async () => {
      const postId = 1;
      const guestId = 'uuid';
      const foundPost = { id: postId } as PostType;
      const isLiked = { postId, guestId } as PostLike;
      const foundPostLike = null;

      jest
        .spyOn(postService, 'findPostWithNotFoundException')
        .mockResolvedValue(foundPost);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(isLiked);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(foundPostLike);

      const result = await postService.togglePostLike(postId, guestId);

      expect(result).toEqual({ isLiked: !!foundPostLike });
      expect(postService.findPostWithNotFoundException).toHaveBeenCalled();
      expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
      expect(prismaMock.postLike.delete).toHaveBeenCalledWith({
        where: { postId_guestId: { postId, guestId } },
      });
      expect(prismaMock.postLike.create).not.toHaveBeenCalled();
      expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
    });
  });

  describe('applyCursorPaginationToPost', () => {
    it('should return an array of posts with cursor-based pagination', async () => {
      const cursorPaginationDto = new CursorPaginationDto();
      cursorPaginationDto.cursor =
        'eyJ2YWx1ZXMiOnsiaWQiOjI3fSwib3JkZXIiOlsiaWRfZGVzYyJdfQ==';
      // 디코딩 결과: {"values":{"id":27},"order":["id_desc"]}
      const whereConditions = {
        OR: [
          { title: { contains: 'mock' } },
          { content: { contains: 'mock' } },
        ],
        draft: false,
      };
      const cursorConditions = { id: 27 };
      const orderByConditions = { id: 'desc' };
      const results = [];
      const nextCursor =
        'eyJ2YsdflsdkfjWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';

      jest.spyOn(postService, 'parseCursorWithValidation').mockReturnValue({
        order: cursorPaginationDto.order,
        values: { id: 27 },
      });
      jest
        .spyOn(postService, 'parseOrderWithValidation')
        .mockReturnValue({ id: 'desc' });
      jest.spyOn(prismaMock.post, 'findMany').mockResolvedValue(results);
      jest.spyOn(postService, 'generateNextCursor').mockReturnValue(nextCursor);

      const result = await postService.applyCursorPaginationToPost(
        cursorPaginationDto,
        whereConditions,
      );

      expect(result).toEqual({ results, nextCursor });
      expect(postService.parseCursorWithValidation).toHaveBeenCalledWith(
        cursorPaginationDto.cursor,
      );
      expect(postService.parseOrderWithValidation).toHaveBeenCalledWith(
        cursorPaginationDto.order,
      );
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: whereConditions,
        orderBy: orderByConditions,
        skip: 1,
        take: cursorPaginationDto.take,
        cursor: cursorConditions,
      });
      expect(postService.generateNextCursor).toHaveBeenCalledWith(
        results,
        cursorPaginationDto.order,
      );
    });

    it('should return an array of posts when cursor is not provided', async () => {
      const cursorPaginationDto = new CursorPaginationDto();
      const whereConditions = {
        OR: [
          { title: { contains: 'mock' } },
          { content: { contains: 'mock' } },
        ],
        draft: false,
      };
      const orderByCondition = { id: 'desc' };
      const results = [];
      const nextCursor =
        'eyJ2YsdflsdkfjWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';

      jest
        .spyOn(postService, 'parseOrderWithValidation')
        .mockReturnValue({ id: 'desc' });
      jest.spyOn(prismaMock.post, 'findMany').mockResolvedValue(results);
      jest.spyOn(postService, 'generateNextCursor').mockReturnValue(nextCursor);

      const result = await postService.applyCursorPaginationToPost(
        cursorPaginationDto,
        whereConditions,
      );

      expect(result).toEqual({ results, nextCursor });
      expect(postService.parseOrderWithValidation).toHaveBeenCalled();
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: whereConditions,
        orderBy: orderByCondition,
        skip: 0,
        take: cursorPaginationDto.take,
        cursor: Prisma.skip,
      });
      expect(postService.generateNextCursor).toHaveBeenCalled();
    });
  });

  describe('parseCursorWithValidation', () => {
    it('should parse cursor to object', () => {
      const cursor = 'eyJ2YWx1ZXMiOnsiaWQiOjI3fSwib3JkZXIiOlsiaWRfZGVzYyJdfQ==';
      const values = { id: 27 };
      const order = ['id_desc'];

      const result = postService.parseCursorWithValidation(cursor);

      expect(result).toEqual({ values, order });
    });

    it('should throw a BadRequestException if key of values object is invalid', () => {
      const cursor =
        'eyJ2YWx1ZXMiOnsiaW52YWxpZCI6Mjd9LCJvcmRlciI6WyJpZF9kZXNjIl19';
      // 디코딩: {"values":{"invalid":27},"order":["id_desc"]}

      expect(() => postService.parseCursorWithValidation(cursor)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseOrderWithValidation', () => {
    it('should parse order to object', () => {
      const order = ['id_desc', 'createdAt_asc'];

      const result = postService.parseOrderWithValidation(order);

      expect(result).toEqual({
        id: 'desc',
        createdAt: 'asc',
      });
    });

    it('should throw a BadRequestException if an order array item cannot be split into 2 parts', () => {
      const order = ['id-desc'];

      expect(() => postService.parseOrderWithValidation(order)).toThrow(
        BadRequestException,
      );
    });

    it('should throw a BadRequestException if the key of the order query param is invalid', () => {
      const order = ['invalid_desc'];

      expect(() => postService.parseOrderWithValidation(order)).toThrow(
        BadRequestException,
      );
    });

    it('should throw a BadRequestException if the value of the order query param is invalid', () => {
      const order = ['id_invalid'];

      expect(() => postService.parseOrderWithValidation(order)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('generateNextCursor', () => {
    it('should generate the next cursor in base64 format', () => {
      const results = [{ id: 27 }] as Post[];
      const order = ['id_desc'];
      const base64 = 'eyJ2YWx1ZXMiOnsiaWQiOjI3fSwib3JkZXIiOlsiaWRfZGVzYyJdfQ==';
      // 디코딩 결과: {"values":{"id":27},"order":["id_desc"]}

      const result = postService.generateNextCursor(results, order);

      expect(result).toEqual(base64);
    });

    it('should return null if results.length is 0', () => {
      const results = [];
      const order = ['id_desc'];

      const result = postService.generateNextCursor(results, order);

      expect(result).toEqual(null);
    });
  });

  describe('findPostWithNotFoundException', () => {
    it('should return a post', async () => {
      const foundPost = { id: 1 } as Post;
      const whereConditions = { id: 1 };
      const includeCondition = {};

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(foundPost);

      const result = await postService.findPostWithNotFoundException(
        { id: 1 },
        'errorMessage',
      );

      expect(result).toEqual(foundPost);
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: whereConditions,
        include: includeCondition,
      });
    });

    it('should throw a NotFoundException when post does not exist', async () => {
      const whereConditions = { id: 1 };

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(null);

      await expect(
        postService.findPostWithNotFoundException(
          whereConditions,
          'errorMessage',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });

  describe('handleImageFiles', () => {
    it('should move new incoming images and delete unused images', async () => {
      const currentImages = [
        {
          url: 'http://test.org/public/images/test-A.png',
        },
        {
          url: 'http://test.org/public/images/test-B.png',
        },
        {
          url: 'http://test.org/public/images/test-C.png',
        },
      ] as Image[];
      const incomingImages = [
        'test-B.png',
        'test-C.png',
        'test-D.png',
        'test-F.png',
      ];
      // D, F => imagesToMove
      // A  => imagesToDelete
      const imagesToMove = ['test-D.png', 'test-F.png'];
      const imagesToDelete = ['test-A.png'];
      const serverOrigin = 'http://test.org';

      jest.spyOn(configService, 'get').mockReturnValue(serverOrigin);

      await postService.handleImageFiles(currentImages, incomingImages);

      expect(jest.spyOn(taskService, 'moveFiles')).toHaveBeenCalledWith(
        TEMP_DIRECTORY_PATH,
        IMAGES_DIRECTORY_PATH,
        imagesToMove,
      );
      expect(jest.spyOn(taskService, 'deleteFiles')).toHaveBeenCalledWith(
        IMAGES_DIRECTORY_PATH,
        imagesToDelete,
      );
    });
  });
});
