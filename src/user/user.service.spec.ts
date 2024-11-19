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
        .spyOn(userService, 'findUserWithoutPassword')
        .mockResolvedValue(foundUser);

      const result = await userService.findOne(1);

      expect(result).toEqual(foundUser);
      expect(userService.findUserWithoutPassword).toHaveBeenCalledWith(1);
    });
  });

  describe('remove', () => {
    it('should delete a user when the user exists', async () => {
      const foundUser = {
        id: 1,
        email: 'test@gmail.com',
      } as User;

      jest.spyOn(userService, 'findUserById').mockResolvedValue(foundUser);

      await expect(userService.remove(1)).resolves.toBeUndefined();
      expect(userService.findUserById).toHaveBeenCalledWith(1);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('findUserById', () => {
    it('should return a user by id when the user exists', async () => {
      const foundUser = { id: 1 } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      const result = await userService.findUserById(1);

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a NotFoundException when the user does not exists', async () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      await expect(userService.findUserById(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe('findUserWithoutPassword', () => {
    it('should return a user without password when the user exists', async () => {
      const foundUser = { id: 1 } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      const result = await userService.findUserWithoutPassword(1);

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: { password: true },
      });
    });

    it('should throw a NotFoundException when the user does not exists', async () => {
      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(null);

      await expect(userService.findUserWithoutPassword(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.user.findUnique).toHaveBeenCalled();
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user by email', async () => {
      const email = 'test@gmail.com';
      const foundUser = { id: 1 } as User;

      jest.spyOn(prismaMock.user, 'findUnique').mockResolvedValue(foundUser);

      const result = await userService.findUserByEmail(email);

      expect(result).toEqual(foundUser);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
    });
  });
});
