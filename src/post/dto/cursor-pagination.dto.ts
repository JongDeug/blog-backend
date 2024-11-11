import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CursorPaginationDto {
  @IsString()
  @IsOptional()
  cursor?: string; // base64

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  order: string[] = [`id_desc`]; // [id_desc, likeCount_asc]

  @IsNumber()
  @IsOptional()
  take: number = 4;
}
