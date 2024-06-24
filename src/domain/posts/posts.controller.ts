import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';
import { AuthService } from '../auth/auth.service';
import { CreatePostDto } from './dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { upload } from '@middleware/multer';
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
        this.router.post('/', upload.array('images', 12), this.createPost.bind(this));
    }


    async createPost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) {
                return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));
            }

            // I. req.body, req.files 에 데이터가 각각 담겨옴 => 따라서 validateDto 미들웨어를 사용하면 안됨
            // I. 따로 데이터를 담아서 검증해야함
            const postData: CreatePostDto = plainToInstance(CreatePostDto, req.body);
            const files = req.files as Express.Multer.File[];
            postData.images = files.map(file => ({ path: file.path }));
            const errors = await validate(postData);

            if (errors.length > 0) {
                const errorMessages = errors.map(error =>
                    // I. 앞글자 대문자 : 에러 메시지
                    `${error.property}: ${Object.values(error.constraints!).join(', ')}`,
                ).join('\n ');
                return next(new CustomError(400, 'Bad Request', errorMessages));
            }

            // I. postsService.createPost 호출
            const postId = await this.postsService.createPost(req.user.id, postData);

            res.status(200).json({ id: postId });
        } catch (err) {
            next(err);
        }
    }
}

export default new PostsController(new PostsService(new AuthService()));
