import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PostService } from '../post.service';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { mock, mockDeep, MockProxy, DeepMockProxy } from 'jest-mock-extended';
import { MailService } from 'src/common/mail.service';
import {
  Prisma,
  PrismaClient,
  User,
  Comment,
  GuestComment,
} from '@prisma/client';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';

describe('CommentService', () => {
  let commentService: CommentService;
  let prismaMock: DeepMockProxy<PrismaService>;
  let postService: MockProxy<PostService>;
  let userService: MockProxy<UserService>;
  let authService: MockProxy<AuthService>;
  let mailService: MockProxy<MailService>;

  type FoundPostWithAuthor = Prisma.PromiseReturnType<
    typeof postService.findPostWithAuthor
  >;
  type FoundParentCommentWithAuthors = Prisma.PromiseReturnType<
    typeof commentService.findParentCommentWithAuthors
  >;
  type FoundCommentWithGuest = Prisma.PromiseReturnType<
    typeof commentService.findCommentWithGuest
  >;

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
    prismaMock = module.get(PrismaService);
    postService = module.get(PostService);
    userService = module.get(UserService);
    authService = module.get(AuthService);
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(commentService).toBeDefined();
  });

  // given
  // when
  // then

  describe('createComment', () => {
    it('should create a comment by a user and trigger email notification', async () => {
      const userId = 1;
      const createCommentDto: CreateCommentDto = {
        postId: 1,
        content: 'content',
      };
      const foundUser = { id: userId } as User;
      const foundPost = { id: createCommentDto.postId } as FoundPostWithAuthor;
      const newComment = { id: 40 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(postService, 'findPostWithAuthor')
        .mockResolvedValue(foundPost);
      jest.spyOn(prismaMock.comment, 'create').mockResolvedValue(newComment);

      const result = await commentService.createComment(
        userId,
        createCommentDto,
      );

      expect(result).toEqual(newComment.id);
      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(postService.findPostWithAuthor).toHaveBeenCalledWith(
        createCommentDto.postId,
      );
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: createCommentDto.content,
          author: {
            connect: {
              id: foundUser.id,
            },
          },
          post: {
            connect: {
              id: foundPost.id,
            },
          },
        },
      });
      expect(mailService.sendMailToPostAuthor).toHaveBeenCalledWith(
        foundPost,
        foundUser,
      );
    });
  });

  describe('createChildComment', () => {
    it('should create a child comment by a user and trigger email notification', async () => {
      const userId = 1;
      const createCommentDto: CreateCommentDto = {
        postId: 999,
        parentCommentId: 40,
        content: 'content',
      };
      const foundUser = { id: userId } as User;
      const foundParentComment = {
        id: createCommentDto.parentCommentId,
        postId: createCommentDto.postId,
      } as FoundParentCommentWithAuthors;
      const newChildComment = { id: 41 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findParentCommentWithAuthors')
        .mockResolvedValue(foundParentComment);
      jest
        .spyOn(prismaMock.comment, 'create')
        .mockResolvedValue(newChildComment);

      const result = await commentService.createChildComment(
        userId,
        createCommentDto,
      );

      expect(result).toEqual(newChildComment.id);
      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(commentService.findParentCommentWithAuthors).toHaveBeenCalledWith(
        createCommentDto.parentCommentId,
      );
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: createCommentDto.content,
          parentComment: {
            connect: { id: foundParentComment.id },
          },
          post: {
            connect: { id: foundParentComment.postId },
          },
          author: {
            connect: { id: foundUser.id },
          },
        },
      });
      expect(mailService.sendMailToPostRelatedAuthors).toHaveBeenCalledWith(
        foundParentComment,
        foundUser,
      );
    });

    it('should throw a BadRequestException if postId does not match foundParentComment.postId', async () => {
      const userId = 1;
      const createCommentDto: CreateCommentDto = {
        postId: 999,
        parentCommentId: 40,
        content: 'content',
      };
      const foundUser = { id: userId } as User;
      const foundParentComment = {
        id: createCommentDto.parentCommentId,
        postId: 123123132123,
      } as FoundParentCommentWithAuthors;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findParentCommentWithAuthors')
        .mockResolvedValue(foundParentComment);

      await expect(
        commentService.createChildComment(userId, createCommentDto),
      ).rejects.toThrow(BadRequestException);
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findParentCommentWithAuthors).toHaveBeenCalled();
      expect(prismaMock.comment.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update a comment by a user with permission to edit it', async () => {
      const userId = 1;
      const id = 10;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updated content',
      };
      const foundUser = { id: userId, role: 'USER' } as User;
      const foundComment = { id, authorId: userId } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(commentService.findCommentById).toHaveBeenCalledWith(id);
      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: foundComment.id },
        data: {
          content: updateCommentDto.content,
        },
      });
    });

    it('should update a comment by a admin', async () => {
      const userId = 999;
      const id = 10;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updated content',
      };
      const foundUser = { id: userId, role: 'ADMIN' } as User;
      const foundComment = { id, authorId: 80 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findCommentById).toHaveBeenCalled();
      expect(prismaMock.comment.update).toHaveBeenCalled();
    });

    it('should throw an ForbiddenException if the user does not have the permission to edit the comment', async () => {
      const userId = 1;
      const id = 10;
      const updateCommentDto: UpdateCommentDto = {
        content: 'updated content',
      };
      const foundUser = { id: userId, role: 'USER' } as User;
      const foundComment = { id, authorId: 99999 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.update(userId, id, updateCommentDto),
      ).rejects.toThrow(ForbiddenException);
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findCommentById).toHaveBeenCalled();
      expect(prismaMock.comment.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a comment by a user with permission to delete it', async () => {
      const id = 10;
      const userId = 1;
      const foundUser = { id: userId, role: 'USER' } as User;
      const foundComment = { id, authorId: userId } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalledWith(userId);
      expect(commentService.findCommentById).toHaveBeenCalledWith(id);
      expect(prismaMock.comment.delete).toHaveBeenCalledWith({
        where: { id: foundComment.id },
      });
      expect(prismaMock.guestComment.delete).not.toHaveBeenCalled();
    });

    it('should remove a comment by an admin when the comment was written by a user', async () => {
      const id = 10;
      const userId = 999;
      const foundUser = { id: userId, role: 'ADMIN' } as User;
      const foundComment = { id, authorId: 10 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findCommentById).toHaveBeenCalled();
      expect(prismaMock.comment.delete).toHaveBeenCalled();
      expect(prismaMock.guestComment.delete).not.toHaveBeenCalled();
    });

    it('should remove a comment by an admin when the comment was written by a guest', async () => {
      const id = 10;
      const userId = 999;
      const foundUser = { id: userId, role: 'ADMIN' } as User;
      const foundComment = { id, guestId: 10 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(commentService.remove(id, userId)).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findCommentById).toHaveBeenCalled();
      expect(prismaMock.comment.delete).toHaveBeenCalled();
      expect(prismaMock.guestComment.delete).toHaveBeenCalledWith({
        where: { id: foundComment.guestId },
      });
    });

    it('should throw an ForbiddenException if the user does not have the permission to delete the comment', async () => {
      const id = 10;
      const userId = 1;
      const foundUser = { id: userId, role: 'USER' } as User;
      const foundComment = { id, authorId: 100 } as Comment;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);
      jest
        .spyOn(commentService, 'findCommentById')
        .mockResolvedValue(foundComment);

      await expect(commentService.remove(id, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(userService.findUserById).toHaveBeenCalled();
      expect(commentService.findCommentById).toHaveBeenCalled();
      expect(prismaMock.comment.delete).not.toHaveBeenCalled();
    });
  });

  describe('createCommentByGuest', () => {
    it('should create a comment by a guest and trigger email notification', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
        postId: 1,
      };
      const foundPost = {
        id: createCommentByGuestDto.postId,
      } as FoundPostWithAuthor;
      const newComment = { id: 2 } as Comment;
      const newGuestComment = { id: 3 } as GuestComment;

      jest
        .spyOn(postService, 'findPostWithAuthor')
        .mockResolvedValue(foundPost);
      jest
        .spyOn(prismaMock, '$transaction')
        .mockImplementation(async (cb) => cb(prismaMock));
      jest
        .spyOn(commentService, 'createGuestComment')
        .mockResolvedValue(newGuestComment);
      jest.spyOn(prismaMock.comment, 'create').mockResolvedValue(newComment);

      const result = await commentService.createCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );

      expect(result).toEqual(newComment.id);
      expect(postService.findPostWithAuthor).toHaveBeenCalledWith(
        createCommentByGuestDto.postId,
      );
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(commentService.createGuestComment).toHaveBeenCalledWith(
        prismaMock,
        guestId,
        createCommentByGuestDto,
      );
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: createCommentByGuestDto.content,
          guest: {
            connect: { id: newGuestComment.id },
          },
          post: {
            connect: { id: foundPost.id },
          },
        },
      });
      expect(mailService.sendMailToPostAuthor).toHaveBeenCalledWith(
        foundPost,
        newGuestComment,
      );
    });
  });

  describe('createChildCommentByGuest', () => {
    it('should create a child comment by a guest and trigger email notification', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 100,
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
        parentCommentId: 10,
      };
      const foundParentComment = {
        id: createCommentByGuestDto.parentCommentId,
        postId: createCommentByGuestDto.postId,
      } as FoundParentCommentWithAuthors;
      const newChildComment = { id: 2 } as Comment;
      const newGuestComment = { id: 3 } as GuestComment;

      jest
        .spyOn(commentService, 'findParentCommentWithAuthors')
        .mockResolvedValue(foundParentComment);
      jest
        .spyOn(prismaMock, '$transaction')
        .mockImplementation(async (cb) => cb(prismaMock));
      jest
        .spyOn(commentService, 'createGuestComment')
        .mockResolvedValue(newGuestComment);
      jest
        .spyOn(prismaMock.comment, 'create')
        .mockResolvedValue(newChildComment);

      const result = await commentService.createChildCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );

      expect(result).toEqual(newChildComment.id);
      expect(commentService.findParentCommentWithAuthors).toHaveBeenCalledWith(
        createCommentByGuestDto.parentCommentId,
      );
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(commentService.createGuestComment).toHaveBeenCalledWith(
        prismaMock,
        guestId,
        createCommentByGuestDto,
      );
      expect(prismaMock.comment.create).toHaveBeenCalledWith({
        data: {
          content: createCommentByGuestDto.content,
          guest: {
            connect: { id: newGuestComment.id },
          },
          post: {
            connect: { id: foundParentComment.postId },
          },
          parentComment: {
            connect: { id: foundParentComment.id },
          },
        },
      });
      expect(mailService.sendMailToPostRelatedAuthors).toHaveBeenCalledWith(
        foundParentComment,
        newGuestComment,
      );
    });

    it('should throw a BadRequestException if postId does not match foundParentComment.postId', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 100,
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
        parentCommentId: 10,
      };
      const foundParentComment = {
        id: createCommentByGuestDto.parentCommentId,
        postId: 123123123,
      } as FoundParentCommentWithAuthors;

      jest
        .spyOn(commentService, 'findParentCommentWithAuthors')
        .mockResolvedValue(foundParentComment);
      jest
        .spyOn(prismaMock, '$transaction')
        .mockImplementation(async (cb) => cb(prismaMock));

      await expect(
        commentService.createChildCommentByGuest(
          guestId,
          createCommentByGuestDto,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(commentService.findParentCommentWithAuthors).toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('updateCommentByGuest', () => {
    it('should update a comment by a guest with the permission to update it', async () => {
      const id = 1;
      const guestId = 'uuid';
      const updateCommentByGuestDto: UpdateCommentByGuestDto = {
        password: '1234',
        content: 'content',
      };
      const foundComment = {
        id,
        guest: { password: updateCommentByGuestDto.password, guestId },
      } as FoundCommentWithGuest;

      jest
        .spyOn(commentService, 'findCommentWithGuest')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.updateCommentByGuest(
          id,
          guestId,
          updateCommentByGuestDto,
        ),
      ).resolves.toBeUndefined();
      expect(commentService.findCommentWithGuest).toHaveBeenCalledWith(id);
      expect(authService.comparePassword).toHaveBeenCalledWith(
        updateCommentByGuestDto.password,
        foundComment.guest.password,
      );
      expect(prismaMock.comment.update).toHaveBeenCalledWith({
        where: { id: foundComment.id },
        data: { content: updateCommentByGuestDto.content },
      });
    });

    it('should throw an UnauthorizedException if the guest does not have the permission to update the comment', async () => {
      const id = 1;
      const guestId = 'uuid';
      const updateCommentByGuestDto: UpdateCommentByGuestDto = {
        password: '1234',
        content: 'content',
      };
      const foundComment = {
        id,
        guest: {
          password: updateCommentByGuestDto.password,
          guestId: 'abcdefghijklm',
        },
      } as FoundCommentWithGuest;

      jest
        .spyOn(commentService, 'findCommentWithGuest')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.updateCommentByGuest(
          id,
          guestId,
          updateCommentByGuestDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(commentService.findCommentWithGuest).toHaveBeenCalled();
      expect(authService.comparePassword).toHaveBeenCalled();
      expect(prismaMock.comment.update).not.toHaveBeenCalled();
    });
  });

  describe('removeCommentByGuest', () => {
    it('should remove a comment by a guest with the permission to delete it', async () => {
      const id = 1;
      const guestId = 'uuid';
      const deleteCommentByGuestDto: DeleteCommentByGuestDto = {
        password: '1234',
      };
      const foundComment = {
        guest: { id, password: deleteCommentByGuestDto.password, guestId },
        guestId: 10,
      } as FoundCommentWithGuest;

      jest
        .spyOn(commentService, 'findCommentWithGuest')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.removeCommentByGuest(
          id,
          guestId,
          deleteCommentByGuestDto,
        ),
      ).resolves.toBeUndefined();
      expect(commentService.findCommentWithGuest).toHaveBeenCalledWith(id);
      expect(authService.comparePassword).toHaveBeenCalledWith(
        deleteCommentByGuestDto.password,
        foundComment.guest.password,
      );
      expect(prismaMock.comment.delete).toHaveBeenCalledWith({
        where: { id: foundComment.id },
      });
      expect(prismaMock.guestComment.delete).toHaveBeenCalledWith({
        where: { id: foundComment.guestId },
      });
    });

    it('should throw an UnauthorizedException if the guest does not have the permission to delete the comment', async () => {
      const id = 1;
      const guestId = 'uuid';
      const deleteCommentByGuestDto: DeleteCommentByGuestDto = {
        password: '1234',
      };
      const foundComment = {
        guest: {
          id,
          password: deleteCommentByGuestDto.password,
          guestId: 'abcdefghijk',
        },
        guestId: 10,
      } as FoundCommentWithGuest;

      jest
        .spyOn(commentService, 'findCommentWithGuest')
        .mockResolvedValue(foundComment);

      await expect(
        commentService.removeCommentByGuest(
          id,
          guestId,
          deleteCommentByGuestDto,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(commentService.findCommentWithGuest).toHaveBeenCalled();
      expect(authService.comparePassword).toHaveBeenCalled();
      expect(prismaMock.comment.delete).not.toHaveBeenCalled();
    });
  });

  describe('findCommentById', () => {
    it('should return a comment when the comment exists', async () => {
      const foundComment = { id: 1 } as Comment;

      jest
        .spyOn(prismaMock.comment, 'findUnique')
        .mockResolvedValue(foundComment);

      const result = await commentService.findCommentById(1);

      expect(result).toEqual(foundComment);
      expect(prismaMock.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      jest.spyOn(prismaMock.comment, 'findUnique').mockResolvedValue(null);

      await expect(commentService.findCommentById(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.comment.findUnique).toHaveBeenCalled();
    });
  });

  describe('findCommentWithGuest', () => {
    it('should return a comment with the guest when the comment exists', async () => {
      const foundComment = { id: 1 } as Comment;

      jest
        .spyOn(prismaMock.comment, 'findUnique')
        .mockResolvedValue(foundComment);

      const result = await commentService.findCommentWithGuest(1);

      expect(result).toEqual(foundComment);
      expect(prismaMock.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 1, authorId: null },
        include: { guest: true },
      });
    });

    it('should throw a NotFoundException when the comment does not exist', async () => {
      jest.spyOn(prismaMock.comment, 'findUnique').mockResolvedValue(null);

      await expect(commentService.findCommentWithGuest(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.comment.findUnique).toHaveBeenCalled();
    });
  });

  describe('findParentCommentWithAuthors', () => {
    it('should return a parent comment with the authors when the parent comment exists', async () => {
      const foundParentComment = { id: 1 } as Comment;

      jest
        .spyOn(prismaMock.comment, 'findUnique')
        .mockResolvedValue(foundParentComment);

      const result = await commentService.findParentCommentWithAuthors(1);

      expect(result).toEqual(foundParentComment);
      expect(prismaMock.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          post: { include: { author: true } },
          childComments: { include: { author: true, guest: true } },
          author: true,
          guest: true,
        },
      });
    });

    it('should throw a NotFoundException when the parent comment does not exist', async () => {
      jest.spyOn(prismaMock.comment, 'findUnique').mockResolvedValue(null);

      await expect(
        commentService.findParentCommentWithAuthors(1),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.comment.findUnique).toHaveBeenCalled();
    });
  });

  describe('createGuestComment', () => {
    it('should create a guestComment with password hashing', async () => {
      const database = prismaMock;
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 999,
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
      };
      const hashedPassword = 'hashedPassword';
      const newGuestComment = {
        id: 100,
        nickName: createCommentByGuestDto.nickName,
        email: createCommentByGuestDto.email,
        password: 'hashedPassword',
        content: createCommentByGuestDto.content,
      } as unknown as GuestComment;

      jest.spyOn(authService, 'hashPassword').mockResolvedValue(hashedPassword);
      jest
        .spyOn(database.guestComment, 'create')
        .mockResolvedValue(newGuestComment);

      const result = await commentService.createGuestComment(
        database,
        guestId,
        createCommentByGuestDto,
      );

      expect(result).toEqual(newGuestComment);
      expect(authService.hashPassword).toHaveBeenCalledWith(
        createCommentByGuestDto.password,
      );
      expect(database.guestComment.create).toHaveBeenCalledWith({
        data: {
          nickName: createCommentByGuestDto.nickName,
          email: createCommentByGuestDto.email,
          password: hashedPassword,
          guest: {
            connectOrCreate: {
              where: { guestId },
              create: { guestId },
            },
          },
        },
      });
    });
  });
});
