import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { mkdir, readdir, rename, unlink } from 'fs/promises';
import { join, parse } from 'path';

@Injectable()
export class TaskService {
  constructor() {}

  // 00:00 자정마다 실행
  @Cron('* * 0 * * *')
  async eraseOrphanFiles() {
    const files = await readdir(join(process.cwd(), 'public', 'temp'));

    const fileArrayToDelete = files.filter((file) => {
      const filename = parse(file).name; // 확장자 제거
      const split = filename.split('_');

      if (split.length !== 2) return true;

      const dateInMillisecond = parseInt(split[split.length - 1]);
      const nowInMillisecond = Date.now();
      const aDayInMillisecond = 24 * 60 * 60 * 1000;

      return nowInMillisecond - dateInMillisecond > aDayInMillisecond;
    });

    await this.deleteFiles(
      join(process.cwd(), 'public', 'temp'),
      fileArrayToDelete,
    );
  }

  async deleteFiles(folderPath: string, files: string[]) {
    try {
      const deletePromises = files.map((fileName: string) => {
        return unlink(join(folderPath, fileName));
      });

      // 병렬 실행
      await Promise.all(deletePromises);
    } catch (e) {
      throw new InternalServerErrorException({
        message: '파일 삭제 에러',
        error: e.code,
        statusCode: 500,
      });
    }
  }

  async movieFiles(oldPath: string, newPath: string, files: string[]) {
    try {
      // 폴더 없으면 생성
      await mkdir(oldPath, { recursive: true });

      // 폴더 이동
      const renamePromises = files.map((fileName: string) => {
        return rename(join(oldPath, fileName), join(newPath, fileName));
      });

      // 병렬 실행
      await Promise.all(renamePromises);
    } catch (e) {
      throw new InternalServerErrorException({
        message: '파일 이동 에러',
        error: e.code,
        statusCode: 500,
      });
    }
  }
}
