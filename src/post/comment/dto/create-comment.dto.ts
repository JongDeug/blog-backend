import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsNumber()
  @IsNotEmpty()
  postId: number; // 댓글

  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  parentCommentId?: number; // 대댓글

  @IsString()
  @IsNotEmpty()
  content: string;
}