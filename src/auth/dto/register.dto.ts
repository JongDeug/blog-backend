import {
  IsEmail,
  IsNotEmpty,
  IsString,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function IsPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
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
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: '이메일 형식이 아닙니다' })
  email: string;

  @IsNotEmpty()
  @IsPassword()
  password: string;
}
