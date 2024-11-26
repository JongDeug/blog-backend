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
  ForbiddenException,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { GetPostsDto } from './dto/get-posts.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { IMAGES_DIRECTORY_PATH, TEMP_DIRECTORY_PATH } from './const/path.const';
import { UpdatePostDto } from './dto/update-post.dto';

describe('PostService', () => {
  let postService: PostService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let configService: MockProxy<ConfigService>;
  let taskService: MockProxy<TaskService>;
  let userService: MockProxy<UserService>;
  let logger: MockProxy<LoggerService>;

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

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest.spyOn(postService, 'createPost').mockResolvedValue(newPost);

      const result = await postService.create(userId, createPostDto);

      expect(result).toEqual(newPost.id);
      expect(userService.findUserById).toHaveBeenCalledWith(userId);
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

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest.spyOn(postService, 'createPost').mockResolvedValue(newPost);
      jest
        .spyOn(taskService, 'moveFiles')
        .mockRejectedValue({ code: 'ENOENT' });

      await expect(postService.create(userId, createPostDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.findUserById).toHaveBeenCalled();
      expect(taskService.moveFiles).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of posts with cursor-based pagination', async () => {
      const getPostsDto = new GetPostsDto();
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
  });

  describe('findOne', () => {
    type PostType = Prisma.PromiseReturnType<
      typeof postService.findPostWithDetails
    >;

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
        .spyOn(postService, 'findPostWithDetails')
        .mockResolvedValue(foundPost);

      const result = await postService.findOne(id, guestId);

      expect(result).toEqual(post);
      expect(postService.findPostWithDetails).toHaveBeenCalledWith(id, guestId);
    });
  });

  describe('update', () => {
    let mockUpdatePostWithTransaction: jest.SpyInstance;
    let mockHandleImageFiles: jest.SpyInstance;
    let postId, userId, updatePostDto, foundUser, foundPost;

    type PostType = Prisma.PromiseReturnType<
      typeof postService.findPostWithImages
    >;

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
      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);

      await postService.update(postId, userId, updatePostDto);

      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(postService.findPostWithImages).toHaveBeenCalledWith(postId);
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

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(ForbiddenException);
      expect(userService.findUserById).toHaveBeenCalled();
      expect(postService.findPostWithImages).toHaveBeenCalled();
      expect(mockUpdatePostWithTransaction).not.toHaveBeenCalled();
    });

    it('should throw a NotFoundException if requested files do not exist', async () => {
      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);
      mockHandleImageFiles.mockRejectedValue({ code: 'ENOENT' });

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(NotFoundException);
      expect(userService.findUserById).toHaveBeenCalled();
      expect(postService.findPostWithImages).toHaveBeenCalled();
      expect(mockUpdatePostWithTransaction).toHaveBeenCalled();
      expect(mockHandleImageFiles).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    type PostType = Prisma.PromiseReturnType<
      typeof postService.findPostWithImages
    >;

    it('should remove a post with all its relations (comments, images, postLikes)', async () => {
      const id = 1;
      const userId = 10;
      const serverOrigin = 'https://test.org';
      const foundUser = { id: userId } as User;
      const foundPost = {
        id,
        title: '제목',
        images: [
          {
            url: `${serverOrigin}/public/images/aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png`,
          },
        ],
        authorId: userId,
      } as PostType;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);
      jest.spyOn(configService, 'get').mockReturnValue(serverOrigin);

      await postService.remove(id, userId);

      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(postService.findPostWithImages).toHaveBeenCalledWith(id);
      expect(prismaMock.post.delete).toHaveBeenCalledWith({ where: { id } });
      expect(taskService.deleteFiles).toHaveBeenCalledWith(
        IMAGES_DIRECTORY_PATH,
        ['aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png'],
      );
    });

    it('should throw a ForbiddenException if the user is not the author of the post', async () => {
      const id = 1;
      const userId = 10;
      const serverOrigin = 'https://test.org';
      const foundUser = { id: userId } as User;
      const foundPost = {
        id,
        title: '제목',
        images: [
          {
            url: `${serverOrigin}/public/images/aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png`,
          },
        ],
        authorId: 123123123123,
      } as PostType;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);

      await expect(postService.remove(id, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(userService.findUserById).toHaveBeenCalled();
      expect(postService.findPostWithImages).toHaveBeenCalled();
      expect(prismaMock.post.delete).not.toHaveBeenCalled();
    });

    it('should throw a NotFoundException if requested files do not exist', async () => {
      const id = 1;
      const userId = 10;
      const serverOrigin = 'https://test.org';
      const foundUser = { id: userId } as User;
      const foundPost = {
        id,
        title: '제목',
        images: [
          {
            url: `${serverOrigin}/public/images/aslfdkjsflksjfd-lkdfjsdlvmlsdf-21sdlkfjas.png`,
          },
        ],
        authorId: userId,
      } as PostType;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithImages')
        .mockResolvedValue(foundPost);
      jest.spyOn(configService, 'get').mockReturnValue(serverOrigin);
      jest
        .spyOn(taskService, 'deleteFiles')
        .mockRejectedValue({ code: 'ENOENT' });

      await expect(postService.remove(id, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(userService.findUserById).toHaveBeenCalled();
      expect(postService.findPostWithImages).toHaveBeenCalled();
      expect(prismaMock.post.delete).toHaveBeenCalled();
      expect(taskService.deleteFiles).toHaveBeenCalled();
    });
  });

  describe('togglePostLike', () => {
    type PostType = Prisma.PromiseReturnType<typeof postService.findPostById>;

    it('should add a like to the post', async () => {
      const postId = 1;
      const guestId = 'uuid';
      const foundPost = { id: postId } as PostType;
      const isLiked = null;
      const foundPostLike = { postId, guestId } as PostLike;

      jest.spyOn(postService, 'findPostById').mockResolvedValue(foundPost);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(isLiked);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(foundPostLike);

      const result = await postService.togglePostLike(postId, guestId);

      expect(result).toEqual({ isLiked: !!foundPostLike });
      expect(postService.findPostById).toHaveBeenCalledWith(postId);
      expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
        where: {
          postId_guestId: {
            postId: foundPost.id,
            guestId,
          },
        },
      });
      expect(prismaMock.postLike.delete).not.toHaveBeenCalled();
      expect(prismaMock.postLike.create).toHaveBeenCalledWith({
        data: {
          post: { connect: { id: foundPost.id } },
          guest: {
            connectOrCreate: { where: { guestId }, create: { guestId } },
          },
        },
      });
      expect(prismaMock.postLike.findUnique).toHaveBeenCalledWith({
        where: { postId_guestId: { postId: foundPost.id, guestId } },
      });
    });

    it('should remove a like from the post', async () => {
      const postId = 1;
      const guestId = 'uuid';
      const foundPost = { id: postId } as PostType;
      const isLiked = { postId, guestId } as PostLike;
      const foundPostLike = null;

      jest.spyOn(postService, 'findPostById').mockResolvedValue(foundPost);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(isLiked);
      jest
        .spyOn(prismaMock.postLike, 'findUnique')
        .mockResolvedValueOnce(foundPostLike);

      const result = await postService.togglePostLike(postId, guestId);

      expect(result).toEqual({ isLiked: !!foundPostLike });
      expect(postService.findPostById).toHaveBeenCalled();
      expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
      expect(prismaMock.postLike.delete).toHaveBeenCalledWith({
        where: { postId_guestId: { postId: foundPost.id, guestId } },
      });
      expect(prismaMock.postLike.create).not.toHaveBeenCalled();
      expect(prismaMock.postLike.findUnique).toHaveBeenCalled();
    });
  });

  describe('applyCursorPaginationToPost', () => {
    it('should return an array of posts with cursor-based pagination', async () => {
      const getPostsDto = new GetPostsDto();
      getPostsDto.cursor =
        'eyJ2YWx1ZXMiOnsiaWQiOjI3fSwib3JkZXIiOlsiaWRfZGVzYyJdfQ==';
      getPostsDto.search = 'search';
      // 디코딩 결과: {"values":{"id":27},"order":["id_desc"]}
      const cursorConditions = { id: 27 };
      const orderByConditions = { id: 'desc' };
      const results = [];
      const nextCursor =
        'eyJ2YsdflsdkfjWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';

      jest.spyOn(postService, 'parseCursorWithValidation').mockReturnValue({
        order: getPostsDto.order,
        values: { id: 27 },
      });
      jest
        .spyOn(postService, 'parseOrderWithValidation')
        .mockReturnValue({ id: 'desc' });
      jest.spyOn(prismaMock.post, 'findMany').mockResolvedValue(results);
      jest.spyOn(postService, 'generateNextCursor').mockReturnValue(nextCursor);

      const result = await postService.applyCursorPaginationToPost(getPostsDto);

      expect(result).toEqual({ results, nextCursor });
      expect(postService.parseCursorWithValidation).toHaveBeenCalledWith(
        getPostsDto.cursor,
      );
      expect(postService.parseOrderWithValidation).toHaveBeenCalledWith(
        getPostsDto.order,
      );
      expect(prismaMock.post.findMany).toHaveBeenCalled();
      expect(postService.generateNextCursor).toHaveBeenCalledWith(
        results,
        getPostsDto.order,
      );
    });

    it('should return an array of posts with cursor-based pagination without search conditions', async () => {
      const getPostsDto = new GetPostsDto();
      getPostsDto.cursor =
        'eyJ2YWx1ZXMiOnsiaWQiOjI3fSwib3JkZXIiOlsiaWRfZGVzYyJdfQ==';
      // 디코딩 결과: {"values":{"id":27},"order":["id_desc"]}
      const cursorConditions = { id: 27 };
      const orderByConditions = { id: 'desc' };
      const results = [];
      const nextCursor =
        'eyJ2YsdflsdkfjWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';

      jest.spyOn(postService, 'parseCursorWithValidation').mockReturnValue({
        order: getPostsDto.order,
        values: { id: 27 },
      });
      jest
        .spyOn(postService, 'parseOrderWithValidation')
        .mockReturnValue({ id: 'desc' });
      jest.spyOn(prismaMock.post, 'findMany').mockResolvedValue(results);
      jest.spyOn(postService, 'generateNextCursor').mockReturnValue(nextCursor);

      const result = await postService.applyCursorPaginationToPost(getPostsDto);

      expect(result).toEqual({ results, nextCursor });
      expect(postService.parseCursorWithValidation).toHaveBeenCalled();
      expect(postService.parseOrderWithValidation).toHaveBeenCalled();
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {
          draft: false,
        },
        orderBy: orderByConditions,
        skip: 1,
        take: getPostsDto.take,
        cursor: cursorConditions,
      });
      expect(postService.generateNextCursor).toHaveBeenCalled();
    });

    it('should return an array of posts when cursor is not provided', async () => {
      const getPostsDto = new GetPostsDto();
      getPostsDto.search = 'search';
      getPostsDto.draft = false;

      const orderByCondition = { id: 'desc' };
      const results = [];
      const nextCursor =
        'eyJ2YsdflsdkfjWQiOjI5N30sIm9yZGVyIjpbImlkX2Rlc2MiXX0=';

      jest
        .spyOn(postService, 'parseOrderWithValidation')
        .mockReturnValue({ id: 'desc' });
      jest.spyOn(prismaMock.post, 'findMany').mockResolvedValue(results);
      jest.spyOn(postService, 'generateNextCursor').mockReturnValue(nextCursor);

      const result = await postService.applyCursorPaginationToPost(getPostsDto);

      expect(result).toEqual({ results, nextCursor });
      expect(postService.parseOrderWithValidation).toHaveBeenCalled();
      expect(prismaMock.post.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'search' } },
            { content: { contains: 'search' } },
          ],
          draft: false,
        },
        orderBy: orderByCondition,
        skip: 0,
        take: getPostsDto.take,
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

  describe('findPostById', () => {
    it('should return a post by id when the post exists', async () => {
      const foundPost = { id: 1 } as Post;

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(foundPost);

      const result = await postService.findPostById(1);

      expect(result).toEqual(foundPost);
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(null);

      await expect(postService.findPostById(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });

  describe('findPostWithAuthor', () => {
    it('should return a post with author when the post exists', async () => {
      const foundPost = { id: 1 } as Post;

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(foundPost);

      const result = await postService.findPostWithAuthor(1);

      expect(result).toEqual(foundPost);
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { author: true },
      });
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(null);

      await expect(postService.findPostWithAuthor(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });

  describe('findPostWithImages', () => {
    it('should return a post with images when the post exists', async () => {
      const foundPost = { id: 1 } as Post;

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(foundPost);

      const result = await postService.findPostWithImages(1);

      expect(result).toEqual(foundPost);
      expect(prismaMock.post.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { images: true },
      });
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(null);

      await expect(postService.findPostWithImages(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });

  describe('findPostWithDetails', () => {
    it('should return a post with details when the post exists', async () => {
      const guestId = 'uuid';
      const foundPost = { id: 1 } as Post;

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(foundPost);

      const result = await postService.findPostWithDetails(1, guestId);

      expect(result).toEqual(foundPost);
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      const guestId = 'uuid';

      jest.spyOn(prismaMock.post, 'findUnique').mockResolvedValue(null);

      await expect(postService.findPostWithDetails(1, guestId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.post.findUnique).toHaveBeenCalled();
    });
  });
});
