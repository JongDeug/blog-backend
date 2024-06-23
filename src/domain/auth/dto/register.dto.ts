import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty({message: '이름을 입력해주세요'})
    name: string;

    @IsEmail()
    @IsNotEmpty({message: '이메일을 입력해주세요'})
    email: string;

    @IsString()
    @IsNotEmpty({message: '비밀번호를 입력해주세요'})
    password: string;

    @IsString()
    @IsOptional() // 옵셔널 데코레이터
    description?: string;
}

