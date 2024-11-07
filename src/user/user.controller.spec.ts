import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { User } from '@prisma/client';

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: MockProxy<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mock<UserService>(),
        },
      ],
    }).compile();

    userController = module.get<UserController>(UserController);
    mockUserService = module.get(UserService);
  });

  // given
  // when
  // then

  describe('findAll', () => {
    it('should return an array of all users', async () => {
      jest.spyOn(mockUserService, 'findAll').mockResolvedValue([]);

      const result = await userController.findAll();

      expect(result).toEqual([]);
      expect(mockUserService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      const foundUser = { id: 1, email: 'test@gmail.com' };

      jest
        .spyOn(mockUserService, 'findOne')
        .mockResolvedValue(foundUser as User);

      const result = await userController.findOne(1);

      expect(result).toEqual(foundUser);
      expect(mockUserService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      jest.spyOn(mockUserService, 'remove').mockResolvedValue(undefined);

      const result = await userController.remove(1);

      expect(result).toBeUndefined();
      expect(mockUserService.remove).toHaveBeenCalledWith(1);
    });
  });
});
