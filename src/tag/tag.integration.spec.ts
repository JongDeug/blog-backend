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
import { Category, Post, Tag, User } from '@prisma/client';

describe('UserService - Integration Test', () => {
  let tagService: TagService;
  let prismaService: PrismaService;

  let user: User;
  let tags: Tag[];
  let category: Category;
  let post: Post;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    tagService = module.get<TagService>(TagService);
    prismaService = module.get<PrismaService>(PrismaService);

    // SEEDING
    user = await ((id) => {
      return prismaService.user.create({
        data: {
          id,
          name: `test${id}`,
          email: `test${id}@gmail.com`,
          password: '1234',
        },
      });
    })(1);

    tags = await Promise.all(
      [2, 3].map((id) =>
        prismaService.tag.create({
          data: { id, name: `tag${id}` },
        }),
      ),
    );

    category = await ((name) => {
      return prismaService.category.create({
        data: { name },
      });
    })('category');

    post = await ((id) => {
      return prismaService.post.create({
        data: {
          title: `title${id}`,
          content: `content${id}`,
          summary: `summary${id}`,
          author: {
            connect: { id: user.id },
          },
          category: {
            connect: { name: category.name },
          },
          tags: {
            connect: { name: tags[1].name },
          },
        },
      });
    })(1);
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
        name: 'tag100',
      };

      const result = await tagService.create(createTagDto);

      expect(result).toHaveProperty('name', 'tag100');
    });

    it('should throw a ConflictException when the tag exists', async () => {
      const createTagDto: CreateTagDto = {
        name: tags[0].name,
      };

      await expect(tagService.create(createTagDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of all tags', async () => {
      const result = await tagService.findAll();

      expect(result).toHaveLength(tags.length + 1);
    });
  });

  describe('findTagById', () => {
    it('should return a tag with posts field when the tag exists', async () => {
      const result = await tagService.findTagById(tags[0].id);

      expect(result).toHaveProperty('name', tags[0].name);
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
      const id = tags[0].id;
      const updateTagDto: UpdateTagDto = {
        name: 'updatedTag',
      };

      await expect(
        tagService.update(id, updateTagDto),
      ).resolves.toBeUndefined();
      await expect(tagService.findTagById(id)).resolves.toHaveProperty(
        'name',
        'updatedTag',
      );
    });
  });

  describe('remove', () => {
    it('should remove a tag', async () => {
      const id = tags[0].id;

      await expect(tagService.remove(id)).resolves.toBeUndefined();
      await expect(tagService.findTagById(id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw a BadRequestException when the length of tag.posts is greater than 0', async () => {
      const id = tags[1].id;

      await expect(tagService.remove(id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkTagExists', () => {
    it('should check if the tag exists', async () => {
      await expect(tagService.checkTagExists('tag5')).resolves.toBeUndefined();
    });

    it('should throw a ConflictException when the tag exists', async () => {
      await expect(tagService.checkTagExists(tags[1].name)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
