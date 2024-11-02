import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UserId } from 'src/user/decorator/user-id.decorator';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { Role } from '@prisma/client';
import { GetPostsDto } from './dto/get-posts.dto';
import { Public } from 'src/auth/decorator/public.decorator';
import { Request } from 'express';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @RBAC(Role.ADMIN)
  create(@UserId() userId: number, @Body() createPostDto: CreatePostDto) {
    return this.postService.create(userId, createPostDto);
  }

  @Get()
  @Public()
  findAll(@Query() getPostsDto: GetPostsDto) {
    return this.postService.findAll(getPostsDto);
  }

  @Get(':id')
  @Public()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('guestLikeId') guestLikeId: string,
  ) {
    return this.postService.findOne(id, guestLikeId);
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
  @RBAC(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postService.remove(id);
  }

  @Get('like/:id')
  @Public()
  async like(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const { guestId } = req.cookies;

    if (!guestId) {
      throw new BadRequestException('쿠키에 guestId가 없습니다');
    }

    return this.postService.togglePostLike(id, guestId);
  }
}
