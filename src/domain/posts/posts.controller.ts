import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';
import { AuthService } from '../auth/auth.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { upload, validateDtoWithFiles } from '@middleware';
import { CustomError } from '@utils';

export class PostsController {
    path: string;
    router: Router;

    constructor(private readonly postsService: PostsService) {
        this.path = '/posts';
        this.router = Router();
        this.init();
    }

    init() {
        this.router.post('/', upload.array('images', 12), validateDtoWithFiles(CreatePostDto), this.createPost.bind(this));
        this.router.patch('/:id', upload.array('images', 12), validateDtoWithFiles(UpdatePostDto), this.updatePost.bind(this));
    }

    async createPost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) {
                return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            }

            // I. postsService.createPost 호출
            const files = req.files as Express.Multer.File[];
            const images = files.map(file => ({ path: file.path }));
            const postId = await this.postsService.createPost(req.user.id, { ...req.body, images });

            res.status(200).json({ id: postId });
        } catch (err) {
            next(err);
        }
    }

    async updatePost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) {
                return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            }
            // I. 게시글 Id 받기
            const { id } = req.params;

            // I. postsService.updatePost 호출
            const files = req.files as Express.Multer.File[];
            const images = files.map(file => ({ path: file.path }));
            await this.postsService.updatePost(req.user.id, id, { ...req.body, images });

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }
}

export default new PostsController(new PostsService(new AuthService()));
