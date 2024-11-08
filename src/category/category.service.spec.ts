import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Category, Post, PrismaClient } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateCategoryDto } from './dto/update-category.dto';

describe('CategoryService', () => {
  let categoryService: CategoryService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
      ],
    }).compile();

    categoryService = module.get<CategoryService>(CategoryService);
    prismaMock = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(categoryService).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    const createCategoryDto: CreateCategoryDto = {
      name: '운영체제',
    };

    it('should create a category', async () => {
      const newCategory: Category = {
        id: 1,
        name: createCategoryDto.name,
      } as Category;

      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaMock.category, 'create').mockResolvedValue(newCategory);

      const result = await categoryService.create(createCategoryDto);

      expect(result).toEqual(newCategory);
      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { name: createCategoryDto.name },
      });
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: { name: createCategoryDto.name },
      });
    });

    it('should a ConflictException when the category exists', async () => {
      const categoryExists = { id: 1, name: '운영체제' } as Category;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(categoryExists);

      await expect(categoryService.create(createCategoryDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
      expect(prismaMock.category.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of all categories', async () => {
      jest.spyOn(prismaMock.category, 'findMany').mockResolvedValue([]);

      const result = await categoryService.findAll();

      expect(result).toEqual([]);
      expect(prismaMock.category.findMany).toHaveBeenCalledWith({
        include: {
          _count: {
            select: { posts: true },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a category when the category exists', async () => {
      const foundCategory = { id: 1, name: '운영체제' } as Category;
      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(foundCategory);

      const result = await categoryService.findOne(1);

      expect(result).toEqual(foundCategory);
      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { posts: true },
      });
    });

    it('should throw a NotFoundException when the category does not exist', async () => {
      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);

      await expect(categoryService.findOne(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateCategoryDto: UpdateCategoryDto = { name: '윈도우' };
    const foundCategory = { id: 1, name: '리눅스' } as Category;

    it('should update a category', async () => {
      const newCategory = { id: 1, name: updateCategoryDto.name } as Category;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValueOnce(foundCategory);
      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValueOnce(null);
      jest.spyOn(prismaMock.category, 'update').mockResolvedValue(newCategory);

      const result = await categoryService.update(1, updateCategoryDto);

      expect(result).toEqual(newCategory);
      expect(prismaMock.category.findUnique).toHaveBeenNthCalledWith(1, {
        where: { id: 1 },
      });
      expect(prismaMock.category.findUnique).toHaveBeenNthCalledWith(2, {
        where: { name: updateCategoryDto.name },
      });
      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: updateCategoryDto.name,
        },
      });
    });

    it('should throw a NotFoundException when the category to update does not exist', async () => {
      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);

      await expect(
        categoryService.update(1, updateCategoryDto),
      ).rejects.toThrow(NotFoundException);
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
    });

    it('should throw a ConflictException when the category already exists for the update', async () => {
      const targetCategoryExists = { id: 2, name: 'DB' } as Category;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValueOnce(foundCategory);
      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValueOnce(targetCategoryExists);

      await expect(
        categoryService.update(1, updateCategoryDto),
      ).rejects.toThrow(ConflictException);
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
      expect(prismaMock.category.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    type CategoryWithPosts = Category & { posts: Post[] };

    it('should delete a category', async () => {
      const foundCategory = {
        id: 1,
        name: '운영체제',
        posts: [],
      } as CategoryWithPosts;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(foundCategory);

      await categoryService.remove(1);

      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { posts: true },
      });
      expect(prismaMock.category.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a NotFoundException when the category to delete does not exist', async () => {
      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);

      await expect(categoryService.remove(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });

    it('should throw a BadRequestException when trying to remove a category that is referenced by posts', async () => {
      const foundCategory = {
        id: 1,
        name: '운영체제',
        posts: [{ id: 10 } as Post],
      } as CategoryWithPosts;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(foundCategory);

      await expect(categoryService.remove(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });
  });
});
