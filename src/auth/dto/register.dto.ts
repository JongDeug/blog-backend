import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export function IsPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return value && value.length >= 4 && value.length <= 14;
        },
        defaultMessage() {
          return '비밀번호는 4~14자여야 합니다';
        },
      },
    });
  };
}

export class RegisterDto {
  @ApiProperty({ example: '아무개' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'amuge01@gmail.com' })
  @IsEmail({}, { message: '이메일 형식이 아닙니다' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '1234' })
  @IsPassword()
  @IsNotEmpty()
  password: string;
}
