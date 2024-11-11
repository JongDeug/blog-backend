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

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  // given
  // when
  // then

  describe('findAll', () => {
    it('should return an array of all users', async () => {
      jest.spyOn(prismaMock.user, 'findMany').mockResolvedValue([] as User[]);

      const result = await userService.findAll();

      expect(result).toEqual([]);
      expect(prismaMock.user.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user when the user exists', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      } as User;

      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);

      const result = await userService.findOne(1);

      expect(result).toEqual(foundUser);
      expect(userService.findUserWithNotFoundException).toHaveBeenCalledWith(
        { id: 1 },
        '존재하지 않는 사용자입니다',
        { password: true },
      );
    });
  });

  describe('remove', () => {
    it('should delete a user when the user exists', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      } as User;

      jest
        .spyOn(userService, 'findUserWithNotFoundException')
        .mockResolvedValue(foundUser);

      const result = await userService.remove(1);

      expect(result).toEqual(undefined);
      expect(userService.findUserWithNotFoundException).toHaveBeenCalledWith(
        { id: 1 },
        '존재하지 않는 사용자입니다',
      );
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('findUserWithNotFoundException', () => {
    it('should find and return a user by unique column', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      const result = await userService.findUserWithNotFoundException(
        { id: foundUser.id },
        '에러 메시지',
      );

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: foundUser.id },
        omit: {},
      });
    });

    it('should throw a NotFoundException when the user does not exists', async () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      await expect(
        userService.findUserWithNotFoundException({ id: 1 }, '에러 메시지'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });
});
