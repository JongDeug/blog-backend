import { Test, TestingModule } from '@nestjs/testing';
import { TagService } from './tag.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient, Tag, Post, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateTagDto } from './dto/update-tag.dto';

describe('TagService', () => {
  let tagService: TagService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  type TagType = Prisma.PromiseReturnType<typeof tagService.findTagById>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
      ],
    }).compile();

    tagService = module.get<TagService>(TagService);
    prismaMock = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(tagService).toBeDefined();
  });

  // given
  // when
  // then

  describe('create', () => {
    const createTagDto: CreateTagDto = {
      name: '리눅스',
    };

    it('should create a tag', async () => {
      const newTag: Tag = {
        id: 1,
        name: createTagDto.name,
      };

      jest.spyOn(tagService, 'findTagByName');
      jest.spyOn(prismaMock.tag, 'create').mockResolvedValue(newTag);

      const result = await tagService.create(createTagDto);

      expect(result).toEqual(newTag);
      expect(tagService.findTagByName).toHaveBeenCalledWith(createTagDto.name);
      expect(prismaMock.tag.create).toHaveBeenCalledWith({
        data: { name: createTagDto.name },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of all tags', async () => {
      jest.spyOn(prismaMock.tag, 'findMany').mockResolvedValue([]);

      const result = await tagService.findAll();

      expect(result).toEqual([]);
      expect(prismaMock.tag.findMany).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should return a tag when the tag exists', async () => {
      const foundTag = { id: 1, name: '리눅스' } as TagType;

      jest.spyOn(tagService, 'findTagById').mockResolvedValue(foundTag);

      const result = await tagService.findOne(1);

      expect(result).toEqual(foundTag);
      expect(tagService.findTagById).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    const updateTagDto: UpdateTagDto = { name: '윈도우' };
    const foundTag = { id: 1, name: '리눅스' } as TagType;

    it('should update a tag', async () => {
      const newTag = { id: 1, name: updateTagDto.name };

      jest.spyOn(tagService, 'findTagById').mockResolvedValue(foundTag);
      jest.spyOn(tagService, 'findTagByName');
      jest.spyOn(prismaMock.tag, 'update').mockResolvedValue(newTag);

      const result = await tagService.update(1, updateTagDto);

      expect(result).toEqual(newTag);
      expect(tagService.findTagById).toHaveBeenCalledWith(1);
      expect(tagService.findTagByName).toHaveBeenCalledWith(updateTagDto.name);
      expect(prismaMock.tag.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: updateTagDto.name,
        },
      });
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      const foundTag = { id: 1, name: '리눅스', posts: [] } as TagType;

      jest.spyOn(tagService, 'findTagById').mockResolvedValue(foundTag);

      await tagService.remove(1);

      expect(tagService.findTagById).toHaveBeenCalledWith(1);
      expect(prismaMock.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw a BadRequestException when trying to remove a tag that is referenced by posts', async () => {
      const foundTag: Tag & { posts: Post[] } = {
        id: 1,
        name: '리눅스',
        posts: [{ id: 10 } as Post],
      } as TagType;

      jest.spyOn(tagService, 'findTagById').mockResolvedValue(foundTag);

      await expect(tagService.remove(1)).rejects.toThrow(BadRequestException);
      expect(tagService.findTagById).toHaveBeenCalled();
      expect(prismaMock.tag.delete).not.toHaveBeenCalled();
    });
  });

  describe('findTagById', () => {
    it('should return a tag by id when the tag exists', async () => {
      const foundTag = { id: 1 } as TagType;

      jest.spyOn(prismaMock.tag, 'findUnique').mockResolvedValue(foundTag);

      const result = await tagService.findTagById(1);

      expect(result).toEqual(foundTag);
      expect(prismaMock.tag.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { posts: true },
      });
    });

    it('should throw a NotFoundException when the tag does not exist', async () => {
      jest.spyOn(prismaMock.tag, 'findUnique').mockResolvedValue(null);

      await expect(tagService.findTagById(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.tag.findUnique).toHaveBeenCalled();
    });
  });

  describe('findTagByName', () => {
    it('should not throw an error when the tag does not exist', async () => {
      const name = '태그';

      jest.spyOn(prismaMock.tag, 'findUnique').mockResolvedValue(null);

      await expect(tagService.findTagByName(name)).resolves.toBeUndefined();
      expect(prismaMock.tag.findUnique).toHaveBeenCalledWith({
        where: { name },
      });
    });

    it('should throw a ConflictException when the tag exists', async () => {
      const name = '태그';
      const foundTag = { id: 1, name } as TagType;

      jest.spyOn(prismaMock.tag, 'findUnique').mockResolvedValue(foundTag);

      await expect(tagService.findTagByName(name)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.tag.findUnique).toHaveBeenCalled();
    });
  });
});
