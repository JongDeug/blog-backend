import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { CommonService } from './common.service';
import { Public } from 'src/auth/decorator/public.decorator';

@Controller('common')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

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

  @Get('feed')
  @Public()
  async getRssFeed(@Query('url') url: string) {
    return this.commonService.getFeed(url);
  }
}
