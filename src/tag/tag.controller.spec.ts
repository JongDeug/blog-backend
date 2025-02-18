import { Test, TestingModule } from '@nestjs/testing';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { mock, MockProxy } from 'jest-mock-extended';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from '@prisma/client';

describe('TagController', () => {
  let tagController: TagController;
  let tagService: MockProxy<TagService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagController],
      providers: [{ provide: TagService, useValue: mock<TagService>() }],
    }).compile();

    tagController = module.get<TagController>(TagController);
    tagService = module.get(TagService);
  });

  it('should be defined', () => {
    expect(true).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    it('should create a tag', async () => {
      const createTagDto: CreateTagDto = { name: '리눅스' };
      const newTag = { id: 1, name: createTagDto.name } as Tag;

      jest.spyOn(tagService, 'create').mockResolvedValue(newTag);

      const result = await tagController.create(createTagDto);

      expect(result).toEqual(newTag);
      expect(tagService.create).toHaveBeenCalledWith(createTagDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of all tags', async () => {
      jest.spyOn(tagService, 'findAll').mockResolvedValue([]);

      const result = await tagController.findAll();

      expect(result).toEqual([]);
      expect(tagService.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findOne', () => {
    it('should return a tag', async () => {
      const foundTag = {
        id: 1,
        name: '리눅스',
        createdAt: new Date(),
        posts: [],
      };

      jest.spyOn(tagService, 'findTagById').mockResolvedValue(foundTag);

      const result = await tagController.findOne(1);

      expect(result).toEqual(foundTag);
      expect(tagService.findTagById).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update a tag', async () => {
      const updateTagDto: UpdateTagDto = { name: '윈도우' };
      // const updatedTag = { id: 1, name: updateTagDto.name };

      jest.spyOn(tagService, 'update').mockResolvedValue(undefined);

      await expect(
        tagController.update(1, updateTagDto),
      ).resolves.toBeUndefined();
      expect(tagService.update).toHaveBeenCalledWith(1, updateTagDto);
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      jest.spyOn(tagService, 'remove').mockResolvedValue(undefined);

      const result = await tagController.remove(1);

      expect(result).toBeUndefined();
      expect(tagService.remove).toHaveBeenCalledWith(1);
    });
  });
});
