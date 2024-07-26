import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCommentGuestDto {
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}
