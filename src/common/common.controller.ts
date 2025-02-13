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
import { Public } from 'src/auth/decorator/public.decorator';
import { RssService } from './rss.service';

@Controller('common')
export class CommonController {
  constructor(private readonly rssService: RssService) {}

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

  @Get('rss/feed')
  @Public()
  getRssFeed(@Query('url') url: string) {
    return this.rssService.getFeed(url);
  }

  @Get('rss/subscriptions')
  @Public()
  getSubscriptions() {
    return this.rssService.getSubscriptions();
  }
}
