import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';
import { ImagePath } from '@custom-type/customImagePath';
import { Transform } from 'class-transformer';

export class UpdatePostDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    content: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    @IsArray({ message: '배열을 또는 구분자(,)를 사용하여 태그를 입력해주세요' })
    @IsString({ each: true })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' && value !== '' ? value.split(',').map((tag: string) => tag.trim()) : value))
    tags?: string[];

    @IsArray()
    images: ImagePath[]; // 값이 없어도 빈 배열로 변환해서 옴
}
