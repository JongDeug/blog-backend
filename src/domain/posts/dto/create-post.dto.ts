import { IsNotEmpty, IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import { ImagePath } from '@custom-type/customImagePath';
import { Transform } from 'class-transformer';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    @IsString()
    @IsOptional()
    prev: string;

    @IsString()
    @IsOptional()
    next: string;

    @Transform(({ value }) => {
        if (typeof value === 'string') return value.toLowerCase() !== 'false';
    })
    @IsBoolean()
    @IsNotEmpty()
    draft: boolean;

    @Transform(({ value }) =>
        typeof value === 'string' && value !== ''
            ? value.split(',').map((tag: string) => tag.trim())
            : value,
    )
    @IsArray({
        message: '배열을 또는 구분자(,)를 사용하여 태그를 입력해주세요',
    })
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsArray()
    images: ImagePath[]; // 값이 없어도 빈 배열로 변환해서 옴
}
