import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class PostLikeDto {
    @IsString()
    @IsNotEmpty()
    postId: string;

    @IsBoolean()
    @IsNotEmpty()
    tryToLike: boolean;

    @IsString()
    postLikeGuestId?: string;
}
