import { PickType } from '@nestjs/swagger';
import { CreateCommentByGuestDto } from './create-comment-by-guest.dto';

export class UpdateCommentByGuestDto extends PickType(CreateCommentByGuestDto, [
  'password',
  'content',
]) {}
