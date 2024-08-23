import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import database from '@utils/database';
import { CustomError } from '@utils/customError';
import { Prisma } from '../../../prisma/prisma-client';

export class CategoriesService {
    constructor() {
    }

    async createCategory(dto: CreateCategoryDto) {
        // I. 카테고리를 찾고, 있으면 Conflict 에러
        await this.findCategoryByName(dto.name, 409);

        // I. 카테고리 생성
        await database.category.create({
            data: { name: dto.name },
        });
    }

    async updateCategory(name: string, dto: UpdateCategoryDto) {
        // I. 카테고리를 찾고, 없으면 Not Found 에러
        await this.findCategoryByName(name, 404);

        // I. 업데이트 하려는 카테고리가 있으면 Conflict 에러
        await this.findCategoryByName(dto.name, 409);

        // I. 카테고리 업데이트
        await database.category.update({
            where: { name },
            data: { name: dto.name },
        });
    }

    async deleteCategory(name: string) {
        // I. 카테고리를 찾고, 없으면 Not Found 에러
        await this.findCategoryByName(name, 404);

        // I. 카테고리 삭제
        try {
            await database.category.delete({ where: { name } });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError) {
                if (err.code === 'P2003') {
                    // onDelete 를 Restrict 로 설정
                    // 따라서 부모인 카테고리를 삭제하면, 이를 참조하는 Post 자식이 있으면 에러를 반환함
                    throw new CustomError(
                        400,
                        'Bad Request',
                        '카테고리를 참조하고 있는 Post가 존재합니다',
                    );
                }
            }
            throw err;
        }
    }

    async getCategories() {
        // I. 모든 카테고리 반환 + 관련된 post 수
        const categories = await database.category.findMany({
            include: {
                _count: {
                    select: { posts: true },
                },
            },
        });

        return categories.map(category => {
            return {
                name: category.name,
                count: category._count.posts,
            };
        });
    }

    /**
     * Utils
     * findCategoryByName : 카테고리명으로 카테고리 검색
     */
    async findCategoryByName(name: string, statusCode: number) {
        const isExist = await database.category.findUnique({ where: { name } });

        if (statusCode === 404) {
            if (!isExist)
                throw new CustomError(
                    404,
                    'Not Found',
                    '카테고리를 찾을 수 없습니다',
                );
        } else if (statusCode === 409) {
            if (isExist)
                throw new CustomError(
                    409,
                    'Conflict',
                    '이미 존재하는 카테고리입니다',
                );
        }
    }
}
