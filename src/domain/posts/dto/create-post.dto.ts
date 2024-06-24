<<<<<<< HEAD
import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';

type ImagePath = { path: string };

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
<<<<<<< HEAD
    images: ImagePath[];
=======
    images: Express.Multer.File[];
=======
import { IsNotEmpty, IsOptional, IsString, IsArray} from 'class-validator';

export class CreatePostDto {
    @IsString()
    @IsNotEmpty({message: '제목을 입력해주세요'})
    title: string;

    @IsString()
    @IsNotEmpty({message: '내용을 입력해주세요'})
    content: string;

    @IsArray()
    @IsNotEmpty({message: '태그를 입력해주세요(빈 배열이라도)'})
    tags: string[];

    @IsArray()
    @IsNotEmpty({message: '이미지를 입력해주세요(빈 배열이라도)'})
    images: string[];

    @IsString()
    @IsOptional()
    categoryId?: string;
>>>>>>> 8998fb1 (#19 FEAT: 게시글 등록 API 작성 중)
>>>>>>> 2c59301 (Merge confilt 해결)
}
