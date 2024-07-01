import { CategoriesService } from '../../../../src/domain/posts/categories/categories.service';
import { CreateCategoryDto } from '../../../../src/domain/posts/categories/dto';
import { prismaMock } from '../../../singleton';
import { CustomError } from '@utils/customError';

describe('CategoriesService', () => {
    let categoriesService: CategoriesService;

    beforeEach(() => {
        categoriesService = new CategoriesService();
    });

    // --- CreateCategory
    describe('createCategory', () => {
        const mockDto: CreateCategoryDto = {
            name: '새로운 카테고리',
        };
        const mockReturnedCategory = { name: '이미 존재하는 카테고리' };

        test('should create a category successfully', async () => {
            // given
            prismaMock.category.findUnique.mockResolvedValue(null);
            // then
            await categoriesService.createCategory(mockDto);
            // when
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockDto.name } });
            expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: mockDto.name } });
        });

        test('should throw error if category already exists', async () => {
            // given
            prismaMock.category.findUnique.mockResolvedValue(mockReturnedCategory);
            // when, then
            await expect(categoriesService.createCategory(mockDto)).rejects.toThrow(
                new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다'),
            );
            expect(prismaMock.category.findUnique).toHaveBeenCalled();
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
            // given
            prismaMock.category.findUnique.mockResolvedValueOnce({ name: 'target' }).mockResolvedValueOnce(null);
            // when
            await categoriesService.updateCategory(mockName, mockDto);
            // then
            expect(prismaMock.category.findUnique).toHaveBeenCalledTimes(2);
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockName } });
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockDto.name } });
            expect(prismaMock.category.update).toHaveBeenCalledWith({
                where: { name: mockName },
                data: { name: mockDto.name },
            });
        });

        test('should throw error if target category is not found', async () => {
            // given
            prismaMock.category.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            // when
            await expect(categoriesService.updateCategory(mockName, mockDto)).rejects.toThrow(
                new CustomError(404, 'Not Found', '바꾸려는 카테고리를 찾을 수 없습니다'),
            );
            // then
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockName } });
            expect(prismaMock.category.findUnique).not.toHaveBeenCalledWith({ where: { name: mockDto.name } });
        });

        test('should throw error if new category is already exists', async () => {
            // given
            prismaMock.category.findUnique.mockResolvedValueOnce({ name: 'target' }).mockResolvedValueOnce({ name: 'already' });
            // when
            await expect(categoriesService.updateCategory(mockName, mockDto)).rejects.toThrow(
                new CustomError(409, 'Conflict', '업데이트 하려는 카테고리가 이미 존재합니다'),
            );
            // then
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockName } });
            expect(prismaMock.category.findUnique).toHaveBeenCalledWith({ where: { name: mockDto.name } });
            expect(prismaMock.category.update).not.toHaveBeenCalled();
        });
    });
    // ---
});
