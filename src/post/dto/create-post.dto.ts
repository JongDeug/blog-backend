import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  prevId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  nextId?: string;

  @IsBoolean()
  @IsNotEmpty()
  draft: boolean;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  images?: string[] = [];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[] = [];

  @IsString()
  @IsNotEmpty()
  category: string;
}
