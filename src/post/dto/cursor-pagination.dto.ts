import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CursorPaginationDto {
  @ApiPropertyOptional({
    example: 'eyJ2YWx1ZXMiOnsiaWQiOjIzOH0sIm9yZGVyIjpbImlkX2Rlc2MiXX0=',
    description: 'base64 형식, 서버에서 알아서 줌',
  })
  @IsString()
  @IsOptional()
  cursor?: string; // base64

  @ApiPropertyOptional({
    example: ['id_asc'],
    description: '내림차 또는 오름차',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  order: string[] = [`id_desc`]; // [id_desc, likeCount_asc]

  @ApiPropertyOptional({ example: 2, description: '가져올 개수' })
  @IsNumber()
  @IsOptional()
  take: number = 4;
}
