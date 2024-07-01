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
            expect(prismaMock.category.create).toHaveBeenCalledWith({ data: { name: mockDto.name } });
        });

        test('should throw error if category already exists', async () => {
            // given
            prismaMock.category.findUnique.mockResolvedValue(mockReturnedCategory);
            // when, then
            await expect(categoriesService.createCategory(mockDto)).rejects.toThrow(
                new CustomError(409, 'Conflict', '이미 존재하는 카테고리입니다'),
            );
            expect(prismaMock.category.create).not.toHaveBeenCalled();
        });
    });
    // ---
});
