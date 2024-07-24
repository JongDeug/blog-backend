import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateChildCommentGuestDto {
    @IsString()
    @IsNotEmpty()
    parentCommentId: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    nickName: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
