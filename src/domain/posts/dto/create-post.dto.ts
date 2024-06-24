import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';

type ImagePath = { path: string };

export class CreatePostDto {
    @IsString()
    @IsNotEmpty({ message: '제목을 입력해주세요' })
    title: string;

    @IsString()
    @IsNotEmpty({ message: '내용을 입력해주세요' })
    content: string;

    @IsString()
    @IsNotEmpty({ message: '카테고리(폴더명)을 입력해주세요' })
    category: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsArray()
    images: ImagePath[];
}
