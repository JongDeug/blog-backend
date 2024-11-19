import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostService } from '../post.service';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { mock, mockDeep, MockProxy, DeepMockProxy } from 'jest-mock-extended';
import { MailService } from 'src/common/mail.service';
import { PrismaClient } from '@prisma/client';

describe('CommentService', () => {
  let commentService: CommentService;
  let prismaService: DeepMockProxy<PrismaService>;
  let postService: MockProxy<PostService>;
  let userService: MockProxy<UserService>;
  let authService: MockProxy<AuthService>;
  let mailService: MockProxy<MailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: PostService, useValue: mock<PostService>() },
        { provide: UserService, useValue: mock<UserService>() },
        { provide: AuthService, useValue: mock<AuthService>() },
        { provide: MailService, useValue: mock<MailService>() },
      ],
    }).compile();

    commentService = module.get<CommentService>(CommentService);
    prismaService = module.get(PrismaService);
    postService = module.get(PostService);
    userService = module.get(UserService);
    authService = module.get(AuthService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(commentService).toBeDefined();
  });
});
