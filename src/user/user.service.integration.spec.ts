import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';

describe('UserService - Integration Test', () => {
  let userService: UserService;
  let prismaService: PrismaService;

  let users: User[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    userService = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    users = await Promise.all(
      [1, 2].map((id) =>
        prismaService.user.create({
          data: {
            id,
            name: `test${id}`,
            email: `test${id}@gmail.com`,
            password: '1234',
          },
        }),
      ),
    );
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

      expect(result).toHaveLength(users.length);
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('findUserWithoutPassword', () => {
    it('should return a user without the password field when the user exists', async () => {
      const id = users[0].id;

      const result = await userService.findUserWithoutPassword(id);

      expect(result).toHaveProperty('name', users[0].name);
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
      const id = users[0].id;

      await userService.remove(id);
      await expect(userService.findUserWithoutPassword(id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUserById', () => {
    it('should return a user by id', async () => {
      const id = users[1].id;

      const result = await userService.findUserById(id);

      expect(result).toHaveProperty('name', users[1].name);
    });

    it('should throw a NotFoundException when the user does not exist', async () => {
      await expect(userService.findUserById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUserByEmail', () => {
    it('should return a user by email', async () => {
      const email = users[1].email;

      const result = await userService.findUserByEmail(email);

      expect(result).toHaveProperty('email', email);
    });
  });
});
