import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsPassword } from 'src/auth/dto/register.dto';

export class CreateCommentByGuestDto {
  @ApiProperty({ example: 29, description: '게시글 ID' })
  @IsNumber()
  @IsNotEmpty()
  postId: number; // 댓글, 대댓글

  @ApiProperty({ example: 49, description: '부모 댓글 ID' })
  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  parentCommentId?: number; // 대댓글

  @ApiProperty({ example: '익명' })
  @IsString()
  @IsNotEmpty()
  nickName: string;

  @ApiProperty({ example: 'commentTest@gmail.com' })
  @IsEmail({}, { message: '이메일 형식이 아닙니다' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '1234' })
  @IsPassword()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '테스트 게스트용 댓글 내용' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
