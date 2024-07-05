import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class PostLikeDto {
    @IsString()
    @IsNotEmpty({ message: '게시글 아이디가 필요합니다' })
    postId: string;

    @IsBoolean()
    @IsNotEmpty({ message: '게시글 좋아요 생성인지 삭제인지 알 수 없습니다' })
    tryToLike: boolean;
}
