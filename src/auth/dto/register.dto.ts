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
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail({}, { message: '이메일 형식이 아닙니다' })
  @IsNotEmpty()
  email: string;

  @IsPassword()
  @IsNotEmpty()
  password: string;
}
