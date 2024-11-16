import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MulterModuleOptions,
  MulterOptionsFactory,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { v4 } from 'uuid';

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
  createMulterOptions(): MulterModuleOptions {
    return {
      limits: {
        fileSize: 1000000, // 약 1MB
      },
      fileFilter(_, file, cb) {
        const mimeType = ['image/jpeg', 'image/png'];
        if (!mimeType.includes(file.mimetype)) {
          return cb(
            new BadRequestException('jpeg, png 타입만 업로드 가능합니다'),
            false,
          );
        }
        return cb(null, true);
      },
      storage: diskStorage({
        destination: join(process.cwd(), 'public', 'temp'),
        filename: (_, file, cb) => {
          const extension = file.originalname.split('.').pop();
          const filename = `${v4()}_${Date.now()}.${extension}`;
          cb(null, filename);
        },
      }),
    };
  }
}
