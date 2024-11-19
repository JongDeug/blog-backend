import { PickType } from '@nestjs/swagger';
import { CreateCommentByGuestDto } from './create-comment-by-guest';

export class DeleteCommentByGuestDto extends PickType(CreateCommentByGuestDto, [
  'password',
]) {}
