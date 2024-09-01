import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsArray,
    IsBoolean,
} from 'class-validator';
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

    @IsString()
    @IsNotEmpty()
    summary: string;

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
