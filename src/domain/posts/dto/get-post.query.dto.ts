import { IsOptional, IsString } from 'class-validator';

export class GetPostQueryDto {
    @IsString()
    @IsOptional()
    guestLikeId?: string;
}
