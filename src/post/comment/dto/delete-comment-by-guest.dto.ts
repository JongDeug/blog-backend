import { PickType } from '@nestjs/swagger';
import { CreateCommentByGuestDto } from './create-comment-by-guest.dto';

export class DeleteCommentByGuestDto extends PickType(CreateCommentByGuestDto, [
  'password',
]) {}
