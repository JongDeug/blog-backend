import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import { NotFoundException } from '@nestjs/common';

describe('UserService - Integration Test', () => {
  let userService: UserService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    userService = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    await prismaService.user.createMany({
      data: [
        {
          id: 1,
          name: 'integration1',
          email: 'integration1@gmail.com',
          password: '1234',
        },
        {
          id: 2,
          name: 'integration2',
          email: 'integration2@gmail.com',
          password: '1234',
        },
      ],
    });
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();

    await prismaService.$transaction([deleteUsers]);

    await prismaService.$disconnect();
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of all users', async () => {
      const result = await userService.findAll();
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
    });
  });

  describe('findUserWithoutPassword', () => {
    it('should return a user without the password field when the user exists', async () => {
      const result = await userService.findUserWithoutPassword(1);
      expect(result).toHaveProperty('name', 'integration1');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw a NotFoundException when the user does not exist', async () => {
      await expect(userService.findUserWithoutPassword(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      await userService.remove(1);
      await expect(userService.findUserWithoutPassword(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUserById', () => {
    it('should return a user by id', async () => {
      const result = await userService.findUserById(2);
      expect(result).toHaveProperty('name', 'integration2');
    });

    it('should throw a NotFoundException when the user does not exist', async () => {
      await expect(userService.findUserById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user by email', async () => {
      const email = 'integration2@gmail.com';
      const result = await userService.findUserByEmail(email);
      expect(result).toHaveProperty('email', email);
    });
  });
});
