import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ImagePath } from '@custom-type/customImagePath';

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

    static parseTags = (tags: any) => {
        if (tags === '') return undefined;
        else if (typeof tags === 'string')
            return tags.split(',').map((tag: string) => tag.trim());
        return tags;
    };

    static parseFiles = (files: Express.Multer.File[]) => {
        return files.map((file) => ({ path: file.path }));
    };
}
