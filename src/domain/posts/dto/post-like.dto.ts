import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PostLikeDto {
    @IsString()
    @IsNotEmpty()
    postId: string;

    @IsBoolean()
    @IsNotEmpty()
    tryToLike: boolean;

    @IsString()
    @IsOptional()
    postLikeGuestId?: string;
}
