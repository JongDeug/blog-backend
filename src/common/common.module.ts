import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterConfigService } from './config/multer-config.service';
import { TaskService } from './task.service';

@Module({
  controllers: [CommonController],
  providers: [CommonService, MulterConfigService, TaskService],
  exports: [TaskService],
})
export class CommonModule {}
