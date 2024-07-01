import { NextFunction, Router, Request, Response } from 'express';
import { CategoriesService } from './categories.service';
import { CustomError } from '@utils/customError';
import { validateDto } from '@middleware/validateDto';
import { CreateCategoryDto } from './dto';

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
}

export default new CategoriesController(new CategoriesService());
