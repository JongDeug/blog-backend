import { IsNotEmpty, IsOptional, IsString, IsArray} from 'class-validator';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty({message: '제목을 입력해주세요'})
    title: string;

    @IsString()
    @IsNotEmpty({message: '내용을 입력해주세요'})
    content: string;

    @IsArray()
    @IsNotEmpty({message: '태그를 입력해주세요(빈 배열이라도)'})
    tags: string[];

    @IsArray()
    @IsNotEmpty({message: '이미지를 입력해주세요(빈 배열이라도)'})
    images: string[];

    @IsString()
    @IsOptional()
    categoryId?: string;
}
