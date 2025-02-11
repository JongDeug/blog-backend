import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: '게시글 제목' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '게시글 내용' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 19, description: '이전 게시글 ID' })
  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  prevId?: number;

  @ApiPropertyOptional({ example: 22, description: '다음 게시글 ID' })
  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  nextId?: number;

  @ApiProperty({ example: false, description: '임시 저장' })
  @IsBoolean()
  @IsNotEmpty()
  draft: boolean;

  @ApiProperty({ example: '게시글 요약' })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiPropertyOptional({
    example: [],
    description: '이미지 파일 이름을 담는 배열',
  })
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  images?: string[] = [];

  @ApiPropertyOptional({
    example: ['테스트 태그 1', '테스트 태그 2'],
    description: '태그 이름을 담는 배열',
  })
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @ApiProperty({ example: '알고리즘', description: '카테고리 이름' })
  @IsString()
  @IsNotEmpty()
  category: string;
}
