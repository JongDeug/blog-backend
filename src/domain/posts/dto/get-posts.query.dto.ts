import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetPostsQueryDto {
    @IsString()
    @IsOptional()
    search?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    @Transform(({ value }) => value ? Number(value) : 1)
    page?: number;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Transform(({ value }) => value ? Number(value) : 10)
    limit?: number;
}
