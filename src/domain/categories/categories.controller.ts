import { NextFunction, Router, Request, Response } from 'express';
import { CategoriesService } from './categories.service';
import { CustomError } from '@utils/customError';
import { validateDto } from '@middleware/validateDto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { verifyRoles } from '@middleware/verifyRoles';
import ROLES from '@utils/roles';

export class CategoriesController {
    path: string;
    router: Router;

    constructor(private readonly categoriesService: CategoriesService) {
        this.path = '/categories';
        this.router = Router();
        this.init();
    }

    init() {
        this.router.post(
            '/',
            verifyRoles(ROLES.admin),
            validateDto(CreateCategoryDto),
            this.createCategory
        );
        this.router.patch(
            '/:name',
            verifyRoles(ROLES.admin),
            validateDto(UpdateCategoryDto),
            this.updateCategory
        );
        this.router.delete(
            '/:name',
            verifyRoles(ROLES.admin),
            this.deleteCategory
        );
        this.router.get('/', this.getCategories);
    }

    createCategory = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요'
                    )
                );

            // I. categoriesService.createCategory 호출
            await this.categoriesService.createCategory(req.body);

            res.status(201).json({});
        } catch (err) {
            next(err);
        }
    };

    updateCategory = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요'
                    )
                );

            // I. param 가져오기
            const { name } = req.params;

            // I. categoriesService.updateCategory 호출
            await this.categoriesService.updateCategory(name, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    deleteCategory = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        try {
            // I. JWT 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요'
                    )
                );

            // I. param 가져오기
            const { name } = req.params;

            // I. categoriesService.deleteCategory 호출
            await this.categoriesService.deleteCategory(name);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    getCategories = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 확인 X

            // I. categoriesService.getCategories 호출
            const categories = await this.categoriesService.getCategories();

            res.status(200).json({ categories });
        } catch (err) {
            next(err);
        }
    };
}

export default new CategoriesController(new CategoriesService());
