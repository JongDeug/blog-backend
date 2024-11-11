import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeepMockProxy, mock, mockDeep, MockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { TaskService } from 'src/common/task.service';

describe('PostService', () => {
  let postService: PostService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let configService: MockProxy<ConfigService>;
  let taskService: MockProxy<TaskService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: TaskService, useValue: mock<TaskService>() },
      ],
    }).compile();

    postService = module.get<PostService>(PostService);
    prismaMock = module.get(PrismaService);
    configService = module.get(ConfigService);
    taskService = module.get(TaskService);
  });

  it('should be defined', () => {
    expect(postService).toBeDefined();
  });
});
