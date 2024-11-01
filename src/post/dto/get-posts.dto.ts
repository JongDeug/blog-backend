import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CursorPaginationDto } from './cursor-pagination.dto';

export class GetPostsDto extends CursorPaginationDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsBoolean()
  @IsOptional()
  draft: boolean = false;
}
