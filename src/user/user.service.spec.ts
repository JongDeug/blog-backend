import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaClient, User } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let userService: UserService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    prismaMock = module.get(PrismaService);
  });

  // given
  // when
  // then

  describe('findAll', () => {
    it('should find all users', async () => {
      jest.spyOn(prismaMock.user, 'findMany').mockResolvedValue([] as User[]);

      const result = await userService.findAll();

      expect(result).toEqual([]);
      expect(prismaMock.user.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find a user', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      };
      jest
        .spyOn(prismaMock.user, 'findUnique')
        .mockResolvedValue(foundUser as User);

      const result = await userService.findOne(1);

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: { password: true },
      });
    });

    it('should throw a NotFoundException if user does not exist', () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      expect(userService.findOne(999)).rejects.toThrow(NotFoundException);
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      };
      jest
        .spyOn(prismaMock.user, 'findUnique')
        .mockResolvedValue(foundUser as User);

      const result = await userService.remove(1);

      expect(result).toEqual(undefined);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a NotFoundException if user does not exist', () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      expect(userService.remove(999)).rejects.toThrow(NotFoundException);
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
    });
  });
});
