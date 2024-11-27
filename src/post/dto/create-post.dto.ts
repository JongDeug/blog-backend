import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  prevId?: number;

  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  nextId?: number;

  @IsBoolean()
  @IsNotEmpty()
  draft: boolean;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  images?: string[] = [];

  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @IsString()
  @IsNotEmpty()
  category: string;
}
