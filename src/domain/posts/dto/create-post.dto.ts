import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsArray,
    IsBoolean,
} from 'class-validator';

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
    prev?: string;

    @IsString()
    @IsOptional()
    next?: string;

    @IsBoolean()
    @IsNotEmpty()
    draft: boolean;

    @IsArray()
    @IsString({ each: true })
    @IsOptional() // if value is falsy => []
    tags: string[] = [];

    @IsArray()
    @IsString({ each: true })
    @IsOptional() // if value is falsy => []
    images: string[] = [];
}
