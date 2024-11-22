import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryService } from './category.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCategoryDto } from './dto/update-category.dto';

describe('CategoryService - Integration Test', () => {
  let categoryService: CategoryService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    categoryService = module.get<CategoryService>(CategoryService);
    prismaService = module.get<PrismaService>(PrismaService);

    await prismaService.category.createMany({
      data: [
        { id: 1, name: 'category1' },
        { id: 2, name: 'category2' },
      ],
    });

    const user = await prismaService.user.create({
      data: {
        id: 3,
        name: 'integration1',
        email: 'integration1@gmail.com',
        password: '1234',
      },
    });

    await prismaService.post.create({
      data: {
        title: 'title',
        content: 'content',
        summary: 'summary',
        author: {
          connect: { id: user.id },
        },
        category: {
          connectOrCreate: {
            where: { name: 'category1' },
            create: { name: 'category1' },
          },
        },
      },
    });
  });

  afterAll(async () => {
    const deleteUsers = prismaService.user.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteCategories = prismaService.category.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteCategories,
      deleteUsers,
    ]);

    await prismaService.$disconnect();
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
      expect(result).toHaveProperty('name', 'newCategory');
    });
  });

  describe('findAll', () => {
    it('should return an array of all categories with their associated post counts', async () => {
      const result = await categoryService.findAll();
      expect(result).toHaveLength(3);
    });
  });

  describe('findCategoryById', () => {
    it('should return a category with associated posts', async () => {
      const result = await categoryService.findCategoryById(1);
      expect(result.name).toEqual('category1');
      expect(result).toHaveProperty('posts');
    });

    it('should throw a NotFoundException when the category does not exist', async () => {
      await expect(categoryService.findCategoryById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const id = 1;
      const updateCategoryDto: UpdateCategoryDto = {
        name: 'updatedCategory',
      };

      await expect(
        categoryService.update(id, updateCategoryDto),
      ).resolves.toBeUndefined();
      await expect(
        categoryService.findCategoryById(id),
      ).resolves.toHaveProperty('name', 'updatedCategory');
    });
  });

  describe('remove', () => {
    it('should remove a category when the length of category.posts is 0', async () => {
      await expect(categoryService.remove(2)).resolves.toBeUndefined();
      await expect(categoryService.findCategoryById(2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a BadRequestException when the length of category.posts is greater than 0', async () => {
      await expect(categoryService.remove(1)).rejects.toThrow(
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
        categoryService.checkCategoryExists('updatedCategory'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
