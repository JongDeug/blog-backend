import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsPassword } from 'src/auth/dto/register.dto';

export class CreateCommentByGuestDto {
  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  postId?: number; // 댓글

  @IsNumber()
  @IsNotEmpty()
  @IsOptional()
  parentCommentId?: number; // 대댓글

  @IsString()
  @IsNotEmpty()
  nickName: string;

  @IsEmail({}, { message: '이메일 형식이 아닙니다' })
  @IsNotEmpty()
  email: string;

  @IsPassword()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
