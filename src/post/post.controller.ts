import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from '@prisma/client';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @RBAC(Role.ADMIN)
  create(@UserId() userId: number, @Body() createPostDto: CreatePostDto) {
    return this.postService.create(userId, createPostDto);
  }

  @Get()
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(+id);
  }

  @Patch(':id')
  @RBAC(Role.ADMIN)
  update(
    @Param('id', ParseIntPipe) postId: number,
    @UserId() userId: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postService.update(postId, userId, updatePostDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postService.remove(+id);
  }
}
