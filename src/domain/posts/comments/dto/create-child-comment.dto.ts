import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChildCommentDto {
    @IsString()
    @IsNotEmpty()
    parentCommentId: string;

    @IsString()
    @IsNotEmpty()
    content: string;
}
