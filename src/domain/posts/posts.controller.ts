import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto';
import { validateDtoWithFiles } from '@middleware/validateDtoWithFiles';
import { upload } from '@middleware/multer';
import { CustomError } from '@utils/customError';
import { pagination } from '@middleware/pagination';
import { PaginationType } from '@custom-type/customPagination';
import { UsersService } from '../users/users.service';
import { CommentsController } from './comments/comments.controller';
import { CommentsService } from './comments/comments.service';
import { validateDto } from '@middleware/validateDto';
import {
    CreateChildCommentDto,
    CreateChildCommentGuestDto,
    CreateCommentDto,
    CreateCommentGuestDto,
    DeleteCommentGuestDto,
    UpdateCommentDto,
    UpdateCommentGuestDto,
} from './comments/dto';
import ROLES from '@utils/roles';
import { verify } from 'jsonwebtoken';
import { verifyRoles } from '@middleware/verifyRoles';

export class PostsController {
    path: string;
    router: Router;
    commentsController: CommentsController;

    constructor(
        private readonly postsService: PostsService,
        private readonly usersService: UsersService,
    ) {
        this.path = '/posts';
        this.router = Router();
        this.commentsController = new CommentsController(
            new CommentsService(
                new UsersService(),
                new PostsService(new UsersService()),
            ),
        );
        this.init();
    }

    init() {
        this.router.post(
            '/',
            verifyRoles(ROLES.admin),
            upload.array('images', 12),
            validateDtoWithFiles(CreatePostDto),
            this.createPost,
        );
        this.router.patch(
            '/:id',
            verifyRoles(ROLES.admin),
            upload.array('images', 12),
            validateDtoWithFiles(UpdatePostDto),
            this.updatePost,
        );
        this.router.delete('/:id', verifyRoles(ROLES.admin), this.deletePost);
        this.router.get('/', pagination, this.getPosts);
        this.router.get('/:id', this.getPost);
        // =====================================================================================
        this.router.post('/like', this.postLike);
        // =====================================================================================
        this.router.post(
            '/comments',
            validateDto(CreateCommentDto),
            this.commentsController.createComment,
        );
        this.router.post(
            '/comments/guest',
            validateDto(CreateCommentGuestDto),
            this.commentsController.createCommentGuest,
        );
        this.router.post(
            '/child-comments',
            validateDto(CreateChildCommentDto),
            this.commentsController.createChildComment,
        );
        this.router.post(
            '/child-comments/guest',
            validateDto(CreateChildCommentGuestDto),
            this.commentsController.createChildCommentGuest,
        );
        this.router.patch(
            '/comments/:id',
            validateDto(UpdateCommentDto),
            this.commentsController.updateComment,
        );
        this.router.patch(
            '/comments/guest/:id',
            validateDto(UpdateCommentGuestDto),
            this.commentsController.updateCommentGuest,
        );
        this.router.delete(
            '/comments/:id',
            this.commentsController.deleteComment,
        );
        this.router.delete(
            '/comments/guest/:id',
            validateDto(DeleteCommentGuestDto),
            this.commentsController.deleteCommentGuest,
        );
    }

    createPost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            // I. postsService.createPost 호출
            const postId = await this.postsService.createPost(req.user.id, req.body);

            res.status(201).json({ id: postId });
        } catch (err) {
            next(err);
        }
    };

    updatePost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            // I. 게시글 id 받기
            const { id } = req.params;

            // I. postsService.updatePost 호출
            await this.postsService.updatePost(req.user.id, id, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    deletePost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 인증 확인
            if (!req.user)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '로그인을 진행해주세요',
                    ),
                );

            // I. 게시글 id 받기
            const { id } = req.params;

            // I. postService.deletePost 호출
            await this.postsService.deletePost(req.user.id, id);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };

    getPosts = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 필요 X

            // I. query 체킹
            const { searchQuery, category } = req.query;
            // I. query 타입 가드
            if (typeof searchQuery === 'object')
                return next(
                    new CustomError(
                        400,
                        'Bad Request',
                        'searchQuery: 잘못된 형식입니다',
                    ),
                );
            if (typeof category === 'object')
                return next(
                    new CustomError(
                        400,
                        'Bad Request',
                        'category: 잘못된 형식입니다',
                    ),
                );

            const pagination: PaginationType = req.pagination; // I. middleware pagination 참고

            // I. postsService.getPosts 호출
            const { posts, postCount } = await this.postsService.getPosts(
                pagination,
                searchQuery,
                category,
            );

            res.status(200).json({ posts, postCount });
        } catch (err) {
            next(err);
        }
    };

    getPost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 필요 X

            // I. param 으로 postId 받기, cookies 에서 postLikeGuestId 추출
            const { id } = req.params;
            const { postLikeGuestId } = req.cookies;

            // I. postsService.getPost 호출
            const { post } = await this.postsService.getPost(
                id,
                postLikeGuestId,
            );

            res.status(200).json({ post });
        } catch (err) {
            next(err);
        }
    };

    // 게시글 좋아요 ==========================================================================================

    postLike = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 필요 X

            // I. cookies 에서 postLikeGuestId 추출
            let { postLikeGuestId } = req.cookies;

            // I. postLikeGuestId 생성
            if (!postLikeGuestId) {
                postLikeGuestId = await this.usersService.createGuestForLike();

                // I. Http Only Cookie 를 사용해 토큰 전송
                res.cookie('postLikeGuestId', postLikeGuestId, {
                    httpOnly: true,
                    // sameSite: 'strict', // sameSite 속성 설정
                    // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
                });
            }

            // I. postsService.postLike 호출
            await this.postsService.postLike(postLikeGuestId, req.body);

            res.status(200).json({});
        } catch (err) {
            next(err);
        }
    };
}

export default new PostsController(
    new PostsService(new UsersService()),
    new UsersService(),
);
