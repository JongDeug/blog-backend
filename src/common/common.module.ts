import { Module } from '@nestjs/common';
import { CommonController } from './common.controller';
import { TaskService } from './task.service';
import { MailService } from './mail.service';
import { RssService } from './rss.service';

@Module({
  controllers: [CommonController],
  providers: [TaskService, MailService, RssService],
  exports: [TaskService, MailService, RssService],
})
export class CommonModule {}
