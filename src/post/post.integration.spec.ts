import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PostService } from './post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { Post } from '@prisma/client';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserId } from '../user/decorator/user-id.decorator';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

describe('PostService - Integration Test', () => {
  let postService: PostService;
  let prismaService: PrismaService;

  let seedPost1: Post;
  let seedPost2: Post;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    postService = module.get<PostService>(PostService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    const user = await prismaService.user.create({
      data: {
        id: 1,
        name: 'integration1',
        email: 'integration1@gmail.com',
        password: '1234',
      },
    });

    const user2 = await prismaService.user.create({
      data: {
        id: 2,
        name: 'integration2',
        email: 'integration2@gmail.com',
        password: '1234',
      },
    });

    const category = await prismaService.category.create({
      data: { name: 'category1' },
    });

    seedPost1 = await prismaService.post.create({
      data: {
        title: 'title1',
        content: 'content1',
        summary: 'summary1',
        author: {
          connect: { id: user.id },
        },
        category: {
          connect: { id: category.id },
        },
        draft: false,
      },
    });

    seedPost2 = await prismaService.post.create({
      data: {
        title: 'title2',
        content: 'content2',
        summary: 'summary2',
        author: {
          connect: { id: user.id },
        },
        category: {
          connect: { id: category.id },
        },
        draft: false,
        images: {
          createMany: {
            data: [
              {
                url: new URL('seedImage', postService.getBaseURL()).toString(),
              },
            ],
          },
        },
      },
    });

    await prismaService.post.create({
      data: {
        title: 'title3',
        content: 'content3',
        summary: 'summary3',
        author: {
          connect: { id: user.id },
        },
        category: {
          connect: { id: category.id },
        },
        draft: false,
      },
    });
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();
    const deletePosts = prismaService.post.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteUsers,
      deleteCategory,
    ]);

    await prismaService.$disconnect();
  });

  it('should be defined', () => {
    expect(postService).toBeDefined();
  });

  describe('create', () => {
    it('should create a post and return the post id', async () => {
      const userId = 1;
      const createPostDto = new CreatePostDto();
      createPostDto.title = 'createTitle';
      createPostDto.content = 'createContent';
      createPostDto.draft = false;
      createPostDto.summary = 'createSummary';
      createPostDto.category = 'createCategory';

      const result = await postService.create(userId, createPostDto);
      expect(result).toEqual(expect.any(Number));
    });

    // console.log 출력돼서 주석 처리
    // it('should throw a NotFoundException if the image does not exist', async () => {
    //   const userId = 1;
    //   const createPostDto = new CreatePostDto();
    //   createPostDto.title = 'createTitle2';
    //   createPostDto.content = 'createContent2';
    //   createPostDto.draft = false;
    //   createPostDto.summary = 'createSummary2';
    //   createPostDto.category = 'createCategory2';
    //   createPostDto.images = ['wrong path'];

    //   await expect(postService.create(userId, createPostDto)).rejects.toThrow(
    //     NotFoundException,
    //   );
    // });
  });

  describe('findAll', () => {
    it('should return an array of all posts and cursor', async () => {
      const getPostsDto = new GetPostsDto();

      const result = await postService.findAll(getPostsDto);
      expect(result.posts).toHaveLength(4);
      expect(result.cursor).toEqual(expect.any(String));
    });
  });

  describe('findOne', () => {
    it('should return a post with isLiked field', async () => {
      const id = seedPost1.id;
      const guestId = 'uuid';

      const result = await postService.findOne(id, guestId);

      expect(result.title).toEqual('title1');
      expect(result.isLiked).toEqual(false);
    });
  });

  describe('update', () => {
    it('should update a post successfully', async () => {
      const postId = seedPost1.id;
      const userId = 1;
      const updatePostDto = new UpdatePostDto();
      updatePostDto.title = 'updatedTitle';

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).resolves.toBeUndefined();
      await expect(postService.findPostById(postId)).resolves.toHaveProperty(
        'title',
        'updatedTitle',
      );
    });

    it('should throw a ForbiddenException if the user does not have permission to update the post', async () => {
      const postId = seedPost1.id;
      const userId = 2;
      const updatePostDto = new UpdatePostDto();
      updatePostDto.title = 'updatedTitle';

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(ForbiddenException);
    });

    // console.log 출력돼서 주석 처리
    // it('should throw a NotFoundException if the image does not exist', async () => {
    //   const postId = seedPost1.id;
    //   const userId = 1;
    //   const updatePostDto = new UpdatePostDto();
    //   updatePostDto.title = 'updatedTitle';
    //   updatePostDto.images = ['wrong'];

    //   await expect(
    //     postService.update(postId, userId, updatePostDto),
    //   ).rejects.toThrow(NotFoundException);
    // });
  });

  describe('remove', () => {
    it('should remove a post successfully', async () => {
      const id = seedPost1.id;

      await expect(postService.remove(id)).resolves.toBeUndefined();
      await expect(postService.findPostById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    // console.log 출력돼서 주석 처리
    // it('should throw a NotFoundException if the image does not exist', async () => {
    //   const id = seedPost2.id;

    //   await expect(postService.remove(id)).rejects.toThrow(NotFoundException);
    // });
  });

  describe('togglePostLike', () => {
    it('should add a like to the post', async () => {
      const postId = seedPost2.id;
      const guestId = 'uuid';

      const result = await postService.togglePostLike(postId, guestId);

      expect(result.isLiked).toBe(true);
    });

    it('should remove a like from the post', async () => {
      const postId = seedPost2.id;
      const guestId = 'uuid';

      const result = await postService.togglePostLike(postId, guestId);

      expect(result.isLiked).toBe(false);
    });
  });

  // applyCursorPaginationToPost 제외, findAll에서 했음

  // parseCursorWithValidation 제외, unit test에서 했음

  // parseOrderWithValidation 제외, unit test에서 했음

  // generateNextCursor 제외, unit test에서 했음

  // getBaseURL 제외

  // createPost 제외, create에서 했음

  // updatePostWithTransaction 제외, update에서 했음

  // handleImageFiles 제외, unit test에서 했음

  describe('findPostById', () => {
    it('should return a post by id', async () => {
      const result = await postService.findPostById(seedPost2.id);
      expect(result.title).toEqual(seedPost2.title);
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      await expect(postService.findPostById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPostWithAuthor', () => {
    it('should return a post with the author by id', async () => {
      const result = await postService.findPostWithAuthor(seedPost2.id);
      expect(result.title).toEqual(seedPost2.title);
      expect(result).toHaveProperty('author');
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      await expect(postService.findPostWithAuthor(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPostWithImages', () => {
    it('should return a post with the images by id', async () => {
      const result = await postService.findPostWithImages(seedPost2.id);
      expect(result.title).toEqual(seedPost2.title);
      expect(result).toHaveProperty('images');
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      await expect(postService.findPostWithImages(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPostWithDetails', () => {
    it('should return a post with details by id', async () => {
      const guestId = 'uuid';

      const result = await postService.findPostWithDetails(
        seedPost2.id,
        guestId,
      );
      expect(result.title).toEqual(seedPost2.title);
      expect(result).toHaveProperty('comments');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('_count');
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      const guestId = 'uuid';

      await expect(
        postService.findPostWithDetails(999, guestId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
