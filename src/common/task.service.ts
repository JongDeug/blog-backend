import {
  Inject,
  Injectable,
  InternalServerErrorException,
  LoggerService,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { mkdir, readdir, rename, unlink } from 'fs/promises';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { join, parse } from 'path';

@Injectable()
export class TaskService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // 자정(00:00)마다 실행
  @Cron('* * 0 * * *')
  async eraseOrphanFiles() {
    const files = await readdir(join(process.cwd(), 'public', 'temp'));

    const fileArrayToDelete = files.filter((file) => {
      const filename = parse(file).name; // 확장자 제거 후 이름만 뽑기
      const split = filename.split('_');

      if (split.length !== 2) return true;

      const dateInMillisecond = parseInt(split[split.length - 1]);
      const nowInMillisecond = Date.now();
      const aDayInMillisecond = 24 * 60 * 60 * 1000;

      // 24시간이 지났다면
      return nowInMillisecond - dateInMillisecond > aDayInMillisecond;
    });

    await this.deleteFiles(
      join(process.cwd(), 'public', 'temp'),
      fileArrayToDelete,
    );
  }

  // TEST
  // @Cron('* * * * * *')
  // print() {
  //   this.logger.warn('안녕', TaskService.name);
  // }

  async deleteFiles(folderPath: string, files: string[]) {
    const deletePromises = files.map((fileName: string) => {
      return unlink(join(folderPath, fileName));
    });

    // unlink 병렬 실행
    await Promise.all(deletePromises);
  }

  async moveFiles(oldPath: string, newPath: string, files: string[]) {
    // 폴더 없으면 생성
    await mkdir(oldPath, { recursive: true });
    await mkdir(newPath, { recursive: true });

    const renamePromises = files.map((fileName: string) => {
      return rename(join(oldPath, fileName), join(newPath, fileName));
    });

    // rename 병렬 실행
    await Promise.all(renamePromises);
  }
}
