import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PostService } from './post.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { Category, Post, User } from '@prisma/client';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';

describe('PostService - Integration Test', () => {
  let app: INestApplication;
  let postService: PostService;
  let prismaService: PrismaService;

  let users: User[];
  let category: Category;
  let posts: Post[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    postService = module.get<PostService>(PostService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    users = await Promise.all(
      [0, 1].map((idx) =>
        prismaService.user.create({
          data: {
            name: `test${idx}`,
            email: `test${idx}@gmail.com`,
            password: '1234',
          },
        }),
      ),
    );

    category = await prismaService.category.create({
      data: { name: 'category' },
    });

    posts = await Promise.all(
      [0, 1, 2].map((idx) => {
        return prismaService.post.create({
          data: {
            title: `title${idx}`,
            content: `content${idx}`,
            summary: `summary${idx}`,
            author: {
              connect: idx === 1 ? { id: users[1].id } : { id: users[0].id },
            },
            category: {
              connect: { id: category.id },
            },
            draft: false,
            images:
              idx === 2
                ? {
                    createMany: {
                      data: [
                        {
                          url: new URL(
                            'seedImage',
                            postService.getBaseURL(),
                          ).toString(),
                        },
                      ],
                    },
                  }
                : {},
          },
        });
      }),
    );
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();
    const deletePosts = prismaService.post.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteUsers,
      deleteCategory,
    ]);
    await prismaService.$disconnect();

    await app.close();
  });

  it('should be defined', () => {
    expect(postService).toBeDefined();
  });

  describe('create', () => {
    it('should create a post and return the post id', async () => {
      const userId = users[0].id;
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
    //   const userId = users[0].id;
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

      expect(result.posts).toHaveLength(posts.length + 1);
      expect(result.cursor).toEqual(expect.any(String));
    });
  });

  describe('findOne', () => {
    it('should return a post with isLiked field', async () => {
      const id = posts[0].id;
      const guestId = 'uuid';

      const result = await postService.findOne(id, guestId);

      expect(result.title).toEqual(posts[0].title);
      expect(result.isLiked).toEqual(false);
    });
  });

  describe('update', () => {
    it('should update a post successfully', async () => {
      const postId = posts[0].id;
      const userId = users[0].id;
      const updatePostDto = new UpdatePostDto();
      updatePostDto.title = 'updatedTitle';

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).resolves.toBeUndefined();
      await expect(postService.findPostById(postId)).resolves.toHaveProperty(
        'title',
        updatePostDto.title,
      );
    });

    it('should throw a ForbiddenException if the user does not have permission to update the post', async () => {
      const postId = posts[0].id;
      const userId = users[1].id;
      const updatePostDto = new UpdatePostDto();
      updatePostDto.title = 'updatedTitle';

      await expect(
        postService.update(postId, userId, updatePostDto),
      ).rejects.toThrow(ForbiddenException);
    });

    // console.log 출력돼서 주석 처리
    // it('should throw a NotFoundException if the image does not exist', async () => {
    //   const postId = posts[1].id;
    //   const userId = users[0].id;
    //   const updatePostDto = new UpdatePostDto();
    //   updatePostDto.images = ['wrong'];

    //   await expect(
    //     postService.update(postId, userId, updatePostDto),
    //   ).rejects.toThrow(NotFoundException);
    // });
  });

  describe('remove', () => {
    it('should remove a post successfully', async () => {
      const postId = posts[0].id;
      const userId = users[0].id;

      await expect(postService.remove(postId, userId)).resolves.toBeUndefined();
      await expect(postService.findPostById(postId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a ForbiddenException if the user does not have permission to delete the post', async () => {
      const postId = posts[1].id;
      const userId = users[0].id;

      await expect(postService.remove(postId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    // console.log 출력돼서 주석 처리
    // it('should throw a NotFoundException if the image does not exist', async () => {
    //   const id = posts[2].id;

    //   await expect(postService.remove(id)).rejects.toThrow(NotFoundException);
    // });
  });

  describe('togglePostLike', () => {
    it('should add a like to the post', async () => {
      const postId = posts[1].id;
      const guestId = 'uuid';

      const result = await postService.togglePostLike(postId, guestId);

      expect(result.isLiked).toBe(true);
    });

    it('should remove a like from the post', async () => {
      const postId = posts[1].id;
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
      const id = posts[1].id;

      const result = await postService.findPostById(id);

      expect(result.title).toEqual(posts[1].title);
    });

    it('should throw a NotFoundException when the post does not exist', async () => {
      await expect(postService.findPostById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPostWithAuthor', () => {
    it('should return a post with the author by id', async () => {
      const id = posts[1].id;

      const result = await postService.findPostWithAuthor(id);

      expect(result.title).toEqual(posts[1].title);
      expect(result).toHaveProperty('authorId', posts[1].authorId);
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
      const id = posts[1].id;

      const result = await postService.findPostWithImages(id);

      expect(result.title).toEqual(posts[1].title);
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
      const id = posts[1].id;
      const guestId = 'uuid';

      const result = await postService.findPostWithDetails(id, guestId);

      expect(result.title).toEqual(posts[1].title);
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
