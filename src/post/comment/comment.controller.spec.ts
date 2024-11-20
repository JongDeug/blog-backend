import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { mock, MockProxy } from 'jest-mock-extended';

describe('CommentController', () => {
  let commentController: CommentController;
  let commentService: MockProxy<CommentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mock<CommentService>(),
        },
      ],
    }).compile();

    commentController = module.get<CommentController>(CommentController);
    commentService = module.get(CommentService);
  });

  it('should be defined', () => {
    expect(commentController).toBeDefined();
  });
});
