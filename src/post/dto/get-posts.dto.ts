import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { CursorPaginationDto } from './cursor-pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetPostsDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: '검색어' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: '카테고리' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: true, description: '임시 저장인지 아닌지' })
  @Transform(({ obj, key }) => {
    // value는 이미 변환된 값이라 사용못함
    // obj[key]로 관리해야 함
    return obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key];
  })
  @IsBoolean()
  @IsOptional()
  draft: boolean = false;
}
