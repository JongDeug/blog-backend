import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreatePostDto {
    @IsString()
    title: string;

    @IsString()
    content: string;

    @IsArray()
    tags: string[];

    @IsArray()
    images: string[];

    categoryId: string;
}
