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
import { Public } from 'src/auth/decorator/public.decorator';
import { CreateCommentByGuestDto } from './dto/create-comment-by-guest.dto';
import { Cookies } from 'src/common/decorator/cookies.decorator';
import { UpdateCommentByGuestDto } from './dto/update-comment-by-guest.dto';
import { DeleteCommentByGuestDto } from './dto/delete-comment-by-guest.dto';

@Controller('post/comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('user')
  create(@UserId() userId: number, @Body() createCommentDto: CreateCommentDto) {
    const { parentCommentId } = createCommentDto;

    if (!parentCommentId) {
      return this.commentService.createComment(userId, createCommentDto);
    } else {
      return this.commentService.createChildComment(userId, createCommentDto);
    }
  }

  @Patch('user/:id')
  userUpdate(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentService.update(userId, id, updateCommentDto);
  }

  @Delete('user/:id')
  remove(@Param('id', ParseIntPipe) id: number, @UserId() userId: number) {
    return this.commentService.remove(id, userId);
  }

  @Post('guest')
  @Public()
  createByGuest(
    @Cookies('guestId') guestId: string,
    @Body() createCommentByGuestDto: CreateCommentByGuestDto,
  ) {
    const { parentCommentId } = createCommentByGuestDto;

    if (!parentCommentId) {
      return this.commentService.createCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );
    } else {
      return this.commentService.createChildCommentByGuest(
        guestId,
        createCommentByGuestDto,
      );
    }
  }

  @Patch('guest/:id')
  @Public()
  updateByGuest(
    @Param('id', ParseIntPipe) id: number,
    @Cookies('guestId') guestId: string,
    @Body() updateCommentByGuestDto: UpdateCommentByGuestDto,
  ) {
    return this.commentService.updateCommentByGuest(
      id,
      guestId,
      updateCommentByGuestDto,
    );
  }

  @Delete('guest/:id')
  @Public()
  removeByGuest(
    @Param('id', ParseIntPipe) id: number,
    @Cookies('guestId') guestId: string,
    @Body() deleteCommentByGuestDto: DeleteCommentByGuestDto,
  ) {
    return this.commentService.removeCommentByGuest(
      id,
      guestId,
      deleteCommentByGuestDto,
    );
  }
}
