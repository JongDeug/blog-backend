import { Test, TestingModule } from '@nestjs/testing';
import { CategoryService } from './category.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Category, Post, Prisma, PrismaClient } from '@prisma/client';
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

  type CategoryType = Prisma.PromiseReturnType<
    typeof categoryService.findCategoryById
  >;

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

      jest.spyOn(categoryService, 'findCategoryByName');
      jest.spyOn(prismaMock.category, 'create').mockResolvedValue(newCategory);

      const result = await categoryService.create(createCategoryDto);

      expect(result).toEqual(newCategory);
      expect(categoryService.findCategoryByName).toHaveBeenCalledWith(
        createCategoryDto.name,
      );
      expect(prismaMock.category.create).toHaveBeenCalledWith({
        data: { name: createCategoryDto.name },
      });
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
      const foundCategory = { id: 1, name: '운영체제' } as CategoryType;

      jest
        .spyOn(categoryService, 'findCategoryById')
        .mockResolvedValue(foundCategory);

      const result = await categoryService.findOne(1);

      expect(result).toEqual(foundCategory);
      expect(categoryService.findCategoryById).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    const updateCategoryDto: UpdateCategoryDto = { name: '윈도우' };
    const foundCategory = { id: 1, name: '리눅스' } as CategoryType;

    it('should update a category', async () => {
      const newCategory = { id: 1, name: updateCategoryDto.name } as Category;

      jest
        .spyOn(categoryService, 'findCategoryById')
        .mockResolvedValue(foundCategory);
      jest.spyOn(categoryService, 'findCategoryByName');
      jest.spyOn(prismaMock.category, 'update').mockResolvedValue(newCategory);

      const result = await categoryService.update(1, updateCategoryDto);

      expect(result).toEqual(newCategory);
      expect(categoryService.findCategoryById).toHaveBeenCalledWith(1);
      expect(categoryService.findCategoryByName).toHaveBeenCalledWith(
        updateCategoryDto.name,
      );
      expect(prismaMock.category.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: updateCategoryDto.name,
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      const foundCategory = {
        id: 1,
        name: '운영체제',
        posts: [],
      } as CategoryType;

      jest
        .spyOn(categoryService, 'findCategoryById')
        .mockResolvedValue(foundCategory);

      await categoryService.remove(1);

      expect(categoryService.findCategoryById).toHaveBeenCalledWith(1);
      expect(prismaMock.category.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw a BadRequestException when trying to remove a category that is referenced by posts', async () => {
      const foundCategory = {
        id: 1,
        name: '운영체제',
        posts: [{ id: 10 } as Post],
      } as CategoryType;

      jest
        .spyOn(categoryService, 'findCategoryById')
        .mockResolvedValue(foundCategory);

      await expect(categoryService.remove(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(categoryService.findCategoryById).toHaveBeenCalled();
      expect(prismaMock.category.delete).not.toHaveBeenCalled();
    });
  });

  describe('findCategoryById', () => {
    it('should return a category with posts by id when the category exists', async () => {
      const foundCategory = {
        id: 1,
        name: '운영체제',
        posts: [],
      } as CategoryType;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(foundCategory);

      const result = await categoryService.findCategoryById(1);

      expect(result).toEqual(foundCategory);
      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { posts: true },
      });
    });

    it('should throw a NotFoundException when the category does not exist', async () => {
      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);

      await expect(categoryService.findCategoryById(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
    });
  });

  describe('findCategoryByName', () => {
    it('should not throw an error when the category does not exist', async () => {
      const name = '운영체제';

      jest.spyOn(prismaMock.category, 'findUnique').mockResolvedValue(null);

      await expect(
        categoryService.findCategoryByName(name),
      ).resolves.toBeUndefined();
      expect(prismaMock.category.findUnique).toHaveBeenCalledWith({
        where: { name },
      });
    });

    it('should throw a ConflictException when the category exists', async () => {
      const name = '운영체제';
      const categoryExists = { id: 1, name } as Category;

      jest
        .spyOn(prismaMock.category, 'findUnique')
        .mockResolvedValue(categoryExists);

      await expect(categoryService.findCategoryByName(name)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.category.findUnique).toHaveBeenCalled();
    });
  });
});
