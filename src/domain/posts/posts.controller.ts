import { Request, Response, NextFunction, Router } from 'express';
import { PostsService } from './posts.service';
import {
    CreatePostDto,
    GetPostsQueryDto,
    PostLikeDto,
    UpdatePostDto,
} from './dto';
import { upload } from '@middleware/multer';
import { CustomError } from '@utils/customError';
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
import { verifyRoles } from '@middleware/verifyRoles';
import { validateQueryDto } from '@middleware/validateQueryDto';
import { GetPostQueryDto } from './dto/get-post.query.dto';
import process from 'node:process';

export class PostsController {
    path: string;
    router: Router;
    commentsController: CommentsController;

    constructor(private readonly postsService: PostsService) {
        this.path = '/posts';
        this.router = Router();
        this.commentsController = new CommentsController(
            new CommentsService(
                new UsersService(),
                new PostsService(new UsersService())
            )
        );
        this.init();
    }

    init() {
        this.router.post(
            '/',
            verifyRoles(ROLES.admin),
            validateDto(CreatePostDto),
            this.createPost
        );
        this.router.patch(
            '/:id',
            verifyRoles(ROLES.admin),
            validateDto(UpdatePostDto),
            this.updatePost
        );
        this.router.delete('/:id', verifyRoles(ROLES.admin), this.deletePost);
        this.router.get('/', validateQueryDto(GetPostsQueryDto), this.getPosts);
        this.router.get(
            '/:id',
            validateQueryDto(GetPostQueryDto),
            this.getPost
        );
        // =====================================================================================
        this.router.post('/like', validateDto(PostLikeDto), this.postLike);
        this.router.post(
            '/upload',
            verifyRoles(ROLES.admin),
            upload.single('image'),
            this.uploadImage
        );
        // =====================================================================================
        this.router.post(
            '/comments',
            validateDto(CreateCommentDto),
            this.commentsController.createComment
        );
        this.router.post(
            '/comments/guest',
            validateDto(CreateCommentGuestDto),
            this.commentsController.createCommentGuest
        );
        this.router.post(
            '/child-comments',
            validateDto(CreateChildCommentDto),
            this.commentsController.createChildComment
        );
        this.router.post(
            '/child-comments/guest',
            validateDto(CreateChildCommentGuestDto),
            this.commentsController.createChildCommentGuest
        );
        this.router.patch(
            '/comments/:id',
            validateDto(UpdateCommentDto),
            this.commentsController.updateComment
        );
        this.router.patch(
            '/comments/guest/:id',
            validateDto(UpdateCommentGuestDto),
            this.commentsController.updateCommentGuest
        );
        this.router.delete(
            '/comments/:id',
            this.commentsController.deleteComment
        );
        this.router.delete(
            '/comments/guest/:id',
            validateDto(DeleteCommentGuestDto),
            this.commentsController.deleteCommentGuest
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
                        '로그인을 진행해주세요'
                    )
                );

            // I. postsService.createPost 호출
            const postId = await this.postsService.createPost(
                req.user.id,
                req.body
            );

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
                        '로그인을 진행해주세요'
                    )
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
                        '로그인을 진행해주세요'
                    )
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

            // I. query 같은 경우 validateQueryDto 에서 검증 후 req.body 로 값을 넘김

            // I. postsService.getPosts 호출
            const { posts, postCount } = await this.postsService.getPosts(
                req.body.take,
                req.body.skip,
                req.body.search,
                req.body.category
            );

            res.status(200).json({ posts, postCount });
        } catch (err) {
            next(err);
        }
    };

    getPost = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. JWT 필요 X

            // I. query 같은 경우 validateQueryDto 에서 검증 후 req.body 로 값을 넘김

            // I. param 으로 postId 받기, query 로 guestLikeId 받기
            const { id } = req.params;

            // I. postsService.getPost 호출
            const { post } = await this.postsService.getPost(
                id,
                req.body.guestLikeId
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

            // I. postsService.postLike 호출
            const guestLikeId = await this.postsService.postLike(req.body);

            res.status(200).json({ guestLikeId });
        } catch (err) {
            next(err);
        }
    };

    // 이미지 업로드 ==========================================================================================

    uploadImage = async (req: Request, res: Response, next: NextFunction) => {
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

            // I. postsService.uploadImage 호출
            const imagePath = await this.postsService.uploadImage(req.file);

            res.status(200).json({
                success: 1,
                file: { url: `${process.env.ORIGIN}/${imagePath}` },
            });
        } catch (err) {
            next(err);
        }
    };
}

export default new PostsController(new PostsService(new UsersService()));
