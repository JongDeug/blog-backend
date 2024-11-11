import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { CommonModule } from 'src/common/common.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [CommonModule, UserModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
