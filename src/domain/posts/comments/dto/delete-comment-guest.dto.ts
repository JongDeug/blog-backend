import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteCommentGuestDto {
    @IsString()
    @IsNotEmpty()
    password: string;
}
