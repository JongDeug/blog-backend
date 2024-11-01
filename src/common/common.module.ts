import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterConfigService } from './config/multer-config.service';

@Module({
  controllers: [CommonController],
  providers: [CommonService, MulterConfigService],
})
export class CommonModule {}
