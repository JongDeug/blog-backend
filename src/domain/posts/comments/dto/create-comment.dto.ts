import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty({ message: '게시글 아이디가 필요합니다' })
    postId: string;

    @IsString()
    @IsNotEmpty({ message: '댓글 내용이 필요합니다' })
    content: string;
}
