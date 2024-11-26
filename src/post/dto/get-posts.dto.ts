import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CursorPaginationDto } from './cursor-pagination.dto';

export class GetPostsDto extends CursorPaginationDto {
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ obj, key }) => {
    return obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key];
  })
  @IsBoolean()
  @IsOptional()
  draft: boolean = false;
}
