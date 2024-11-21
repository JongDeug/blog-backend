import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppModule } from 'src/app.module';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

describe('UserService - Integration Test', () => {
  let tagService: TagService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    tagService = module.get<TagService>(TagService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    await prismaService.tag.createMany({
      data: [
        { id: 1, name: 'tag1' },
        { id: 2, name: 'tag2' },
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
            where: { name: 'category' },
            create: { name: 'category' },
          },
        },
        tags: {
          connectOrCreate: [
            { where: { name: 'tag1' }, create: { name: 'tag1' } },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const deleteTags = prismaService.tag.deleteMany();
    const deleteUsers = prismaService.user.deleteMany();
    const deletePosts = prismaService.post.deleteMany();
    const deleteCategory = prismaService.category.deleteMany();

    await prismaService.$transaction([
      deletePosts,
      deleteCategory,
      deleteTags,
      deleteUsers,
    ]);

    await prismaService.$disconnect();
  });

  it('should be defined', () => {
    expect(TagService).toBeDefined();
  });

  describe('create', () => {
    it('should create a tag when the tag does not exist', async () => {
      const createTagDto: CreateTagDto = {
        name: 'tag3',
      };
      const result = await tagService.create(createTagDto);
      expect(result).toHaveProperty('name', 'tag3');
    });

    it('should throw a ConflictException when the tag exists', async () => {
      const createTagDto: CreateTagDto = {
        name: 'tag1',
      };
      await expect(tagService.create(createTagDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of all tags', async () => {
      const result = await tagService.findAll();
      expect(result).toHaveLength(3); // create 함수에서 하나 추가 (2 + 1)
      expect(result[0]).toHaveProperty('name', 'tag1');
    });
  });

  describe('findTagById', () => {
    it('should return a tag with posts field when the tag exists', async () => {
      const result = await tagService.findTagById(1);
      expect(result).toHaveProperty('name', 'tag1');
      expect(result).toHaveProperty('posts');
    });

    it('should throw a NotFoundException when the tag does not exist', async () => {
      await expect(tagService.findTagById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a tag', async () => {
      const id = 1;
      const updateTagDto: UpdateTagDto = {
        name: 'updatedTag',
      };

      await expect(
        tagService.update(id, updateTagDto),
      ).resolves.toBeUndefined();
      await expect(tagService.findTagById(1)).resolves.toHaveProperty(
        'name',
        'updatedTag',
      );
    });
  });

  describe('remove', () => {
    it('should remove a tag', async () => {
      await expect(tagService.remove(2)).resolves.toBeUndefined();
      await expect(tagService.findTagById(2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a BadRequestException when the tag is associated with one or more posts', async () => {
      await expect(tagService.remove(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findTagByName', () => {
    it('should check if the tag exists', async () => {
      await expect(tagService.findTagByName('tag5')).resolves.toBeUndefined();
    });

    it('should throw a ConflictException when the tag exists', async () => {
      await expect(tagService.findTagByName('updatedTag')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
