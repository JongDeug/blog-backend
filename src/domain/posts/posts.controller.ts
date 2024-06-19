import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';

export class PostsController {
    path: string;
    router: Router;

    constructor(private readonly postsService: PostsService) {
        this.path = '/posts';
        this.router = Router();
        this.init();
    }

    init() {
        this.router.post('/', this.createPost.bind(this));
        this.router.get('/', this.test.bind(this));
    }

    test(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }

    async createPost(req: Request, res: Response, next: NextFunction) {
        try {
            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }
}

export default new PostsController(new PostsService());
