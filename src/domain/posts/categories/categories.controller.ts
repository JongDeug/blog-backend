import { NextFunction, Router, Request, Response } from 'express';
import { CategoriesService } from './categories.service';
import { CustomError } from '@utils/customError';
import { validateDto } from '@middleware/validateDto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

export class CategoriesController {
    path: string;
    router: Router;

    constructor(private readonly categoriesService: CategoriesService) {
        this.path = '/posts/categories';
        this.router = Router();
        this.init();
    }

    init() {
        this.router.post('/', validateDto(CreateCategoryDto), this.createCategory.bind(this));
        this.router.patch('/:name', validateDto(UpdateCategoryDto), this.updateCategory.bind(this));
        this.router.delete('/:name', this.deleteCategory.bind(this));
    }

    async createCategory(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. categoriesService.createCategory 호출
            await this.categoriesService.createCategory(req.body);

            res.status(201).json({});
        } catch (err) {
            next(err);
        }
    }

    async updateCategory(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. param 가져오기
            const { name } = req.params;

            // I. categoriesService.updateCategory 호출
            await this.categoriesService.updateCategory(name, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }

    async deleteCategory(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. param 가져오기
            const { name } = req.params;

            // I. categoriesService.deleteCategory 호출
            await this.categoriesService.deleteCategory(name);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }
}

export default new CategoriesController(new CategoriesService());
