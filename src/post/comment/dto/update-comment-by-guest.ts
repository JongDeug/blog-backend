import { PickType } from '@nestjs/swagger';
import { CreateCommentByGuestDto } from './create-comment-by-guest';

export class UpdateCommentByGuestDto extends PickType(CreateCommentByGuestDto, [
  'password',
  'content',
]) {}
