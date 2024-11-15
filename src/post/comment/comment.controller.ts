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
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UserId } from 'src/user/decorator/user-id.decorator';

@Controller('post/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('user')
  create(@UserId() userId: number, @Body() createCommentDto: CreateCommentDto) {
    const { parentCommentId } = createCommentDto;

    // 부모 id가 없다면 댓글, 있다면 대댓글
    if (!parentCommentId) {
      return this.commentService.createComment(userId, createCommentDto);
    } else {
      return this.commentService.createChildComment(userId, createCommentDto);
    }
  }

  @Patch('user/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentService.update(id, updateCommentDto);
  }

  @Delete('user/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentService.remove(id);
  }
}
