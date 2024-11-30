import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CursorPaginationDto } from './cursor-pagination.dto';
import { ApiProperty } from '@nestjs/swagger';

export class GetPostsDto extends CursorPaginationDto {
  @ApiProperty({ description: '검색어' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ example: true, description: '임시 저장인지 아닌지' })
  @Transform(({ obj, key }) => {
    return obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key];
  })
  @IsBoolean()
  @IsOptional()
  draft: boolean = false;
}
