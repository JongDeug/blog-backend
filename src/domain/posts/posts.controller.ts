import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';
import { AuthService } from '../auth/auth.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { validateDtoWithFiles } from '@middleware/validateDtoWithFiles';
import { upload } from '@middleware/multer';
import { CustomError } from '@utils/customError';
import { pagination } from '@middleware/pagination';
import { PaginationType } from '@custom-type/customPagination';
import { UsersService } from '../users/users.service';

export class PostsController {
    path: string;
    router: Router;

    constructor(private readonly postsService: PostsService, private readonly usersService: UsersService) {
        this.path = '/posts';
        this.router = Router();
        this.init();
    }

    init() {
        this.router.post('/', upload.array('images', 12), validateDtoWithFiles(CreatePostDto), this.createPost.bind(this));
        this.router.patch('/:id', upload.array('images', 12), validateDtoWithFiles(UpdatePostDto), this.updatePost.bind(this));
        this.router.delete('/:id', this.deletePost.bind(this));
        this.router.get('/', pagination, this.getPosts.bind(this));
        this.router.get('/:id', this.getPost.bind(this));
        // =====================================================================================
        this.router.post('/like', this.postLike.bind(this));
    }

    async createPost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

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
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. 게시글 id 받기
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

    async deletePost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 인증 확인
            if (!req.user) return next(new CustomError(401, 'Unauthorized', '로그인을 진행해주세요'));

            // I. 게시글 id 받기
            const { id } = req.params;

            // I. postService.deletePost 호출
            await this.postsService.deletePost(req.user.id, id);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }

    async getPosts(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 필요 X

            // I. query 체킹
            const { searchQuery, category } = req.query;
            // I. query 타입 가드
            if (typeof searchQuery === 'object') return next(new CustomError(400, 'Bad Request', 'searchQuery: 잘못된 형식입니다'));
            if (typeof category === 'object') return next(new CustomError(400, 'Bad Request', 'category: 잘못된 형식입니다'));

            const pagination: PaginationType = req.pagination; // I. middleware pagination 참고

            // I. postsService.getPosts 호출
            const { posts, postCount } = await this.postsService.getPosts(pagination, searchQuery, category);

            res.status(200).json({ posts, postCount });
        } catch (err) {
            next(err);
        }
    }

    async getPost(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 필요 X

            // I. param 으로 postId 받기, cookies 에서 guestUserId 추출
            const { id } = req.params;
            const { guestUserId } = req.cookies;

            // I. postsService.getPost 호출
            const { post } = await this.postsService.getPost(id, guestUserId);

            res.status(200).json({ post });
        } catch (err) {
            next(err);
        }
    }

    // 게시글 좋아요 ==========================================================================================

    async postLike(req: Request, res: Response, next: NextFunction) {
        try {
            // I. JWT 필요 X

            // I. cookies 에서 guestUserId 추출
            let { guestUserId } = req.cookies;

            // I. guestUserId 생성
            if (!guestUserId) {
                guestUserId = await this.usersService.createGuestUser();

                // I. Http Only Cookie 를 사용해 토큰 전송
                res.cookie('guestUserId', guestUserId, {
                    httpOnly: true,
                    // sameSite: 'strict', // sameSite 속성 설정
                    // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
                });
            }

            // I. postsService.postLike 호출
            await this.postsService.postLike(guestUserId, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    }
}

export default new PostsController(new PostsService(new UsersService()), new UsersService());
