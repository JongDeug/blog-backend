import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PostModule } from '../post.module';
import { UserModule } from 'src/user/user.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [PostModule, UserModule, CommonModule],
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
