import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: '알고리즘' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
