import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { CreatePostDto } from './dto/create-post.dto';
import { GetPostsDto } from './dto/get-posts.dto';
import { Prisma } from '@prisma/client';
import { UpdatePostDto } from './dto/update-post.dto';

describe('PostController', () => {
  let postController: PostController;
  let postService: MockProxy<PostService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: PostService,
          useValue: mock<PostService>(),
        },
      ],
    }).compile();

    postController = module.get<PostController>(PostController);
    postService = module.get(PostService);
  });

  it('should be defined', () => {
    expect(postController).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    it('should create a post and return a new post id', async () => {
      const userId = 1;
      const createPostDto = new CreatePostDto();
      const newPostId = 10;

      jest.spyOn(postService, 'create').mockResolvedValue(newPostId);

      const result = await postController.create(userId, createPostDto);

      expect(result).toEqual(newPostId);
      expect(postService.create).toHaveBeenCalledWith(userId, createPostDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of all posts and the next cursor', async () => {
      const getPostsDto = new GetPostsDto();
      const results = [];
      const nextCursor = 'stringstringstring';

      jest.spyOn(postService, 'findAll').mockResolvedValue({
        posts: results,
        cursor: nextCursor,
      });

      const result = await postController.findAll(getPostsDto);

      expect(result).toEqual({ posts: results, cursor: nextCursor });
      expect(postService.findAll).toHaveBeenCalledWith(getPostsDto);
    });
  });

  describe('findOne', () => {
    it('should return a post including the isLiked field when guestId is provided', async () => {
      const id = 1;
      const guestId = 'uuid';
      type PostType = Prisma.PromiseReturnType<typeof postService.findOne>;
      const post = { id: 10, isLiked: null };
      const isEdit = false;

      jest.spyOn(postService, 'findOne').mockResolvedValue(post as PostType);

      const result = await postController.findOne(id, guestId, isEdit);

      expect(result).toEqual(post);
      expect(postService.findOne).toHaveBeenCalledWith(id, guestId, isEdit);
    });
  });

  describe('update', () => {
    it('should update the post', async () => {
      const postId = 10;
      const userId = 1;
      const updatedPostDto = new UpdatePostDto();

      await postController.update(postId, userId, updatedPostDto);

      expect(postService.update).toHaveBeenCalledWith(
        postId,
        userId,
        updatedPostDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove the post', async () => {
      const id = 1;
      const userId = 10;

      await postController.remove(id, userId);

      expect(postService.remove).toHaveBeenCalledWith(id, userId);
    });
  });

  describe('like', () => {
    it('should toggle the post like', async () => {
      const id = 1;
      const guestId = 'uuid';

      jest
        .spyOn(postService, 'togglePostLike')
        .mockResolvedValue({ isLiked: true });

      const result = await postController.like(id, guestId);

      expect(result).toEqual({ isLiked: true });
      expect(postService.togglePostLike).toHaveBeenCalledWith(id, guestId);
    });
  });
});
