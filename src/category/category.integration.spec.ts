import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryService } from './category.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  BadRequestException,
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, Post, User } from '@prisma/client';

describe('CategoryService - Integration Test', () => {
  let app: INestApplication;
  let categoryService: CategoryService;
  let prismaService: PrismaService;

  let categories: Category[];
  let user: User;
  let post: Post;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    categoryService = module.get<CategoryService>(CategoryService);
    prismaService = module.get<PrismaService>(PrismaService);

    categories = await Promise.all(
      [0, 1, 2].map((idx) =>
        prismaService.category.create({
          data: { name: `category${idx}` },
        }),
      ),
    );

    user = await prismaService.user.create({
      data: {
        name: 'test1',
        email: 'test1@gmail.com',
        password: '1234',
      },
    });

    post = await prismaService.post.create({
      data: {
        title: 'title1',
        content: 'content1',
        summary: 'summary1',
        author: {
          connect: { id: user.id },
        },
        category: {
          connect: { name: categories[0].name },
        },
      },
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleteUsers = prismaService.user.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteCategories = prismaService.category.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteCategories,
      deleteUsers,
    ]);
    await prismaService.$disconnect();

    await app.close();
  });

  it('should be defined', () => {
    expect(CategoryService).toBeDefined();
  });

  describe('create', () => {
    it('should create a category when the category does not exist', async () => {
      const createCategoryDto: CreateCategoryDto = {
        name: 'newCategory',
      };

      const result = await categoryService.create(createCategoryDto);

      expect(result).toHaveProperty('name', createCategoryDto.name);
    });
  });

  describe('findAll', () => {
    it('should return an array of all categories with their associated post counts', async () => {
      const result = await categoryService.findAll();

      expect(result).toHaveLength(categories.length + 1);
    });
  });

  describe('findCategoryById', () => {
    it('should return a category with associated posts', async () => {
      const id = categories[0].id;
      const result = await categoryService.findCategoryById(id);

      expect(result.name).toEqual(categories[0].name);
      expect(result.posts[0]).toHaveProperty('id', post.id);
    });

    it('should throw a NotFoundException when the category does not exist', async () => {
      await expect(categoryService.findCategoryById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const id = categories[0].id;
      const updateCategoryDto: UpdateCategoryDto = {
        name: 'updatedCategory',
      };

      await expect(
        categoryService.update(id, updateCategoryDto),
      ).resolves.toBeUndefined();
      await expect(
        categoryService.findCategoryById(id),
      ).resolves.toHaveProperty('name', updateCategoryDto.name);
    });
  });

  describe('remove', () => {
    it('should remove a category when the length of category.posts is 0', async () => {
      const id = categories[1].id;

      await expect(categoryService.remove(id)).resolves.toBeUndefined();
      await expect(categoryService.findCategoryById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a BadRequestException when the length of category.posts is greater than 0', async () => {
      const id = categories[0].id;

      await expect(categoryService.remove(id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkCategoryExists', () => {
    it('should check if the category exists', async () => {
      await expect(
        categoryService.checkCategoryExists('category999'),
      ).resolves.toBeUndefined();
    });

    it('should throw a ConflictException when the category exists', async () => {
      await expect(
        categoryService.checkCategoryExists(categories[2].name),
      ).rejects.toThrow(ConflictException);
    });
  });
});
