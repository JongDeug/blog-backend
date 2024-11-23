import { Test, TestingModule } from '@nestjs/testing';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';

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

  // given
  // when
  // then

  describe('create', () => {
    it('should create a comment by a user when a parentCommentId is not provided', async () => {
      const userId = 1;
      const createCommentDto: CreateCommentDto = {
        postId: 10,
        content: 'content',
      };
      const newCommentId = 12;

      jest
        .spyOn(commentService, 'createComment')
        .mockResolvedValue(newCommentId);

      const result = await commentController.create(userId, createCommentDto);

      expect(result).toEqual(newCommentId);
      expect(commentService.createComment).toHaveBeenCalledWith(
        userId,
        createCommentDto,
      );
      expect(commentService.createChildComment).not.toHaveBeenCalled();
    });

    it('should create a child comment by a user when a parentCommentId is provided', async () => {
      const userId = 1;
      const createCommentDto: CreateCommentDto = {
        postId: 999,
        parentCommentId: 99,
        content: 'content',
      };
      const newChildCommentId = 12;

      jest
        .spyOn(commentService, 'createChildComment')
        .mockResolvedValue(newChildCommentId);

      const result = await commentController.create(userId, createCommentDto);

      expect(result).toEqual(newChildCommentId);
      expect(commentService.createComment).not.toHaveBeenCalled();
      expect(commentService.createChildComment).toHaveBeenCalledWith(
        userId,
        createCommentDto,
      );
    });
  });

  describe('update', () => {
    it('should update a comment by a user', async () => {
      const id = 10;
      const userId = 1;
      const updateCommentDto: UpdateCommentDto = {
        content: 'content',
      };

      jest.spyOn(commentService, 'update').mockResolvedValue(undefined);

      await expect(
        commentController.update(id, userId, updateCommentDto),
      ).resolves.toBeUndefined();
      expect(commentService.update).toHaveBeenCalledWith(
        userId,
        id,
        updateCommentDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a comment by a user', async () => {
      const id = 10;
      const userId = 1;

      jest.spyOn(commentService, 'remove').mockResolvedValue(undefined);

      await expect(
        commentController.remove(id, userId),
      ).resolves.toBeUndefined();
      expect(commentService.remove).toHaveBeenCalledWith(id, userId);
    });
  });

  describe('createByGuest', () => {
    it('should create a comment by a guest when a parentCommentId is not provided', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 10,
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
      };
      const newCommentId = 12;

      jest
        .spyOn(commentService, 'createCommentByGuest')
        .mockResolvedValue(newCommentId);

      const result = await commentController.createByGuest(
        guestId,
        createCommentByGuestDto,
      );

      expect(result).toEqual(newCommentId);
      expect(commentService.createCommentByGuest).toHaveBeenCalledWith(
        guestId,
        createCommentByGuestDto,
      );
      expect(commentService.createChildCommentByGuest).not.toHaveBeenCalled();
    });

    it('should create a child comment by a guest when a parentCommentId is provided', async () => {
      const guestId = 'uuid';
      const createCommentByGuestDto: CreateCommentByGuestDto = {
        postId: 100,
        parentCommentId: 10,
        nickName: 'nick',
        email: 'test@gmail.com',
        password: '1234',
        content: 'content',
      };
      const newChildCommentId = 12;

      jest
        .spyOn(commentService, 'createChildCommentByGuest')
        .mockResolvedValue(newChildCommentId);

      const result = await commentController.createByGuest(
        guestId,
        createCommentByGuestDto,
      );

      expect(result).toEqual(newChildCommentId);
      expect(commentService.createCommentByGuest).not.toHaveBeenCalled();
      expect(commentService.createChildCommentByGuest).toHaveBeenCalledWith(
        guestId,
        createCommentByGuestDto,
      );
    });
  });

  describe('updateByGuest', () => {
    it('should update a comment by a guest', async () => {
      const id = 10;
      const guestId = 'uuid';
      const updateCommentByGuestDto: UpdateCommentByGuestDto = {
        content: 'content',
        password: '1234',
      };

      jest
        .spyOn(commentService, 'updateCommentByGuest')
        .mockResolvedValue(undefined);

      await expect(
        commentController.updateByGuest(id, guestId, updateCommentByGuestDto),
      ).resolves.toBeUndefined();
      expect(commentService.updateCommentByGuest).toHaveBeenCalledWith(
        id,
        guestId,
        updateCommentByGuestDto,
      );
    });
  });

  describe('removeByGuest', () => {
    it('should remove a comment by a guest', async () => {
      const id = 10;
      const guestId = 'uuid';
      const deleteCommentByGuestDto: DeleteCommentByGuestDto = {
        password: '1234',
      };

      jest
        .spyOn(commentService, 'removeCommentByGuest')
        .mockResolvedValue(undefined);

      await expect(
        commentController.removeByGuest(id, guestId, deleteCommentByGuestDto),
      ).resolves.toBeUndefined();
      expect(commentService.removeCommentByGuest).toHaveBeenCalledWith(
        id,
        guestId,
        deleteCommentByGuestDto,
      );
    });
  });
});
