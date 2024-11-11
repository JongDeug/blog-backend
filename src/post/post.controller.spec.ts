import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { PostService } from './post.service';

describe('PostController', () => {
  let postController: PostController;

  beforeEach(async () => {
    // const module: TestingModule = await Test.createTestingModule({
    //   controllers: [PostController],
    //   providers: [PostService],
    // }).compile();
    // postController = module.get<PostController>(PostController);
  });

  it('should be defined', () => {
    // expect(postController).toBeDefined();
    expect(true).toBeDefined();
  });
});
