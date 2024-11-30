import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 29, description: '게시글 ID' })
  @IsNumber()
  @IsNotEmpty()
  postId: number; // 댓글, 대댓글

  @ApiProperty({ example: 49, description: '부모 댓글 ID' })
  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  parentCommentId?: number; // 대댓글

  @ApiProperty({ example: '테스트 유저용 댓글 내용' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
