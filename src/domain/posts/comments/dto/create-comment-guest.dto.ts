import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentGuestDto {
    @IsString()
    @IsNotEmpty()
    postId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    nickname: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
