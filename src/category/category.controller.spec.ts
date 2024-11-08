import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { Category, Post } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

describe('CategoryController', () => {
  let categoryController: CategoryController;
  let categoryService: MockProxy<CategoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mock<CategoryService>(),
        },
      ],
    }).compile();

    categoryController = module.get<CategoryController>(CategoryController);
    categoryService = module.get(CategoryService);
  });

  it('should be defined', () => {
    expect(categoryController).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    it('should create a category', async () => {
      const createCategoryDto: CreateCategoryDto = { name: '운영체제' };
      const newTag = { id: 1, name: createCategoryDto.name } as Category;

      jest.spyOn(categoryService, 'create').mockResolvedValue(newTag);

      const result = await categoryController.create(createCategoryDto);

      expect(result).toEqual(newTag);
      expect(categoryService.create).toHaveBeenCalledWith(createCategoryDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of all categories', async () => {
      jest.spyOn(categoryService, 'findAll').mockResolvedValue([]);

      const result = await categoryController.findAll();

      expect(result).toEqual([]);
      expect(categoryService.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('should return a category', async () => {
      type CategoryWithPosts = Category & { posts: Post[] };
      const foundCategory = {
        id: 1,
        name: '리눅스',
        posts: [],
      } as CategoryWithPosts;

      jest.spyOn(categoryService, 'findOne').mockResolvedValue(foundCategory);

      const result = await categoryController.findOne(1);

      expect(result).toEqual(foundCategory);
      expect(categoryService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updateCategoryDto: UpdateCategoryDto = { name: '윈도우' };
      const updatedCategory = {
        id: 1,
        name: updateCategoryDto.name,
      } as Category;

      jest.spyOn(categoryService, 'update').mockResolvedValue(updatedCategory);

      const result = await categoryController.update(1, updateCategoryDto);

      expect(result).toEqual(updatedCategory);
      expect(categoryService.update).toHaveBeenCalledWith(1, updateCategoryDto);
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      jest.spyOn(categoryService, 'remove').mockResolvedValue(undefined);

      const result = await categoryController.remove(1);

      expect(result).toBeUndefined();
      expect(categoryService.remove).toHaveBeenCalledWith(1);
    });
  });
});
