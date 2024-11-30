import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RBAC } from 'src/auth/decorator/rbac.decorator';

@Controller('common')
export class CommonController {
  @Post('image')
  @RBAC(Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: '이미지 파일',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  createImage(@UploadedFile() image: Express.Multer.File) {
    return {
      filename: image.filename,
    };
  }
}
