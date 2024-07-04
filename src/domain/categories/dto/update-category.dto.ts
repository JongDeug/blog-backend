import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCategoryDto {
    @IsString()
    @IsNotEmpty({ message: '카테고리명을 입력해주세요' })
    name: string;
}
