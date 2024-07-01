import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import database from '@utils/database';
import { CustomError } from '@utils/customError';

export class CategoriesService {
    constructor() {
    }

    async createCategory(dto: CreateCategoryDto) {
        // I. 카테고리가 이미 있는지 확인
        const isExist = await database.category.findUnique({ where: { name: dto.name } });
        if (isExist) throw new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다');

        // I. 카테고리 생성
        await database.category.create({
            data: { name: dto.name },
        });
    }

    async updateCategory(name: string, dto: UpdateCategoryDto) {
        // I. 기존 카테고리의 존재 여부 확인
        const isTargetCategoryExist= await database.category.findUnique({ where: { name } });
        if (!isTargetCategoryExist) throw new CustomError(404, 'Not Found', '바꾸려는 카테고리를 찾을 수 없습니다');

        // I. 새로운 카테고리의 존재 여부 확인
        const isNewCategoryExists = await database.category.findUnique({ where: { name: dto.name } });
        if (isNewCategoryExists) throw new CustomError(409, 'Conflict', '업데이트 하려는 카테고리가 이미 존재합니다');

        // I. 카테고리 업데이트
        await database.category.update({
            where: { name },
            data: { name: dto.name },
        });
    }
}
