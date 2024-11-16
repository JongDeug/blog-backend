import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { TaskService } from './task.service';
import { MailService } from './mail.service';

@Module({
  controllers: [CommonController],
  providers: [CommonService, TaskService, MailService],
  exports: [TaskService, MailService],
})
export class CommonModule {}
