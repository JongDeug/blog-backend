import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { RBAC } from 'src/auth/decorator/rbac.decorator';

@Controller('common')
export class CommonController {
  @Post('image')
  @RBAC(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  createImage(@UploadedFile() image: Express.Multer.File) {
    return {
      fileName: image.filename,
    };
  }
}
