import { Prisma } from '@prisma';
import { CategoriesService } from '../../../../src/domain/posts/categories/categories.service';
import { CreateCategoryDto } from '../../../../src/domain/posts/categories/dto';
import { prismaMock } from '../../../singleton';
import { CustomError } from '@utils/customError';

describe('CategoriesService', () => {
    let categoriesService: CategoriesService;

    beforeEach(() => {
        categoriesService = new CategoriesService();
        categoriesService.findCategoryByName = jest.fn();
    });

    // Util 함수 mock 해제
    afterEach(() => {
        (categoriesService.findCategoryByName as jest.Mock).mockRestore();
    });

    // --- CreateCategory
    describe('createCategory', () => {
        const mockDto: CreateCategoryDto = {
            name: '새로운 카테고리',
        };
        const mockReturnedCategory = { name: '이미 존재하는 카테고리' };

        test('should create a category successfully', async () => {
            // then
            await categoriesService.createCategory(mockDto);
            // when
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockDto.name, 409);
            expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: mockDto.name } });
        });

        test('should throw error if category already exists', async () => {
            // given
            (categoriesService.findCategoryByName as jest.Mock).mockImplementation(() => {
                throw new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다');
            });
            // when, then
            await expect(categoriesService.createCategory(mockDto)).rejects.toThrow(
                new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다'),
            );
            expect(categoriesService.findCategoryByName).toHaveBeenCalled();
            expect(prismaMock.category.create).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- UpdateCategory
    describe('updateCategory', () => {
        const mockDto: CreateCategoryDto = {
            name: '새로운 카테고리',
        };
        const mockName = 'mockName';

        test('should update a category successfully', async () => {
            // when
            await categoriesService.updateCategory(mockName, mockDto);
            // then
            expect(categoriesService.findCategoryByName).toHaveBeenCalledTimes(2);
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockName, 404);
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockDto.name, 409);
            expect(prismaMock.category.update).toHaveBeenCalledWith({
                where: { name: mockName },
                data: { name: mockDto.name },
            });
        });

        test('should throw error if target category is not found', async () => {
            // given
            (categoriesService.findCategoryByName as jest.Mock).mockImplementation(() => {
                throw new CustomError(404, 'Not Found', '카테고리를 찾을 수 없습니다');
            });
            // when
            await expect(categoriesService.updateCategory(mockName, mockDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '카테고리를 찾을 수 없습니다'),
            );
            // then
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockName, 404);
            expect(categoriesService.findCategoryByName).not.toHaveBeenCalledWith(mockDto.name, 409);
        });

        test('should throw error if new category is already exists', async () => {
            // given
            (categoriesService.findCategoryByName as jest.Mock)
                .mockImplementationOnce(() => {
                })
                .mockImplementationOnce(() => {
                    throw new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다');
                });
            // when, then
            await expect(categoriesService.updateCategory(mockName, mockDto)).rejects.toThrow(
                new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다'),
            );
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockName, 404);
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockDto.name, 409);
            expect(prismaMock.category.update).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- DeleteCategory
    describe('deleteCategory', () => {
        const mockName = 'mockName';

        test('should delete a category successfully', async () => {
            // when
            await categoriesService.deleteCategory(mockName);
            // then
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockName, 404);
            expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { name: mockName } });
        });

        test('should throw error if category is not found', async () => {
            // given
            (categoriesService.findCategoryByName as jest.Mock).mockImplementation(() => {
                throw new CustomError(404, 'Not Found', '카테고리를 찾을 수 없습니다');
            });
            // when, then
            await expect(categoriesService.deleteCategory(mockName)).rejects.toThrow(
                new CustomError(404, 'Not Found', '카테고리를 찾을 수 없습니다'),
            );
            expect(categoriesService.findCategoryByName).toHaveBeenCalledWith(mockName, 404);
            expect(prismaMock.category.delete).not.toHaveBeenCalled();
        });

        test('should throw error if foreign key constraint failed', async () => {
            // given
            prismaMock.category.delete.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003' } as Prisma.PrismaClientKnownRequestError));
            // when, then
            await expect(categoriesService.deleteCategory(mockName)).rejects.toThrow(
                new CustomError(400, 'Bad Request', '카테고리를 참조하고 있는 Post가 존재합니다'),
            );
            expect(categoriesService.findCategoryByName).toHaveBeenCalled();
            expect(prismaMock.category.delete).toHaveBeenCalled();
        });

        test('should throw error if database.category.delete throw another errors', async () => {
            // given
            prismaMock.category.delete.mockRejectedValue(new Error('데이터베이스: 카테고리 삭제 오류'));
            // when, then
            await expect(categoriesService.deleteCategory(mockName)).rejects.toThrow(
                new Error('데이터베이스: 카테고리 삭제 오류'),
            );
            expect(categoriesService.findCategoryByName).toHaveBeenCalled();
            expect(prismaMock.category.delete).toHaveBeenCalled();
        });
    });
    // ---
});
