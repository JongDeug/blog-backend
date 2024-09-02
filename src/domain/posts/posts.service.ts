import { CreatePostDto, PostLikeDto, UpdatePostDto } from './dto';
import { CustomError } from '@utils/customError';
import database from '@utils/database';
import { deleteImages } from '@utils/filesystem';
import { Prisma } from '../../../prisma/prisma-client';
import { UsersService } from '../users/users.service';
import redisClient from '@utils/redis';

export class PostsService {
    constructor(private readonly usersService: UsersService) {}

    async createPost(userId: string, dto: CreatePostDto) {
        // I. user 찾기, user 가 없다면 에러 반환
        const user = await this.usersService.findUserById(userId);

        // I. 트랜젝션을 통해 중간에 실패해도 롤백할 수 있음.
        const newPost = await database.$transaction(async (database) => {
            // I. 게시글 생성
            const post = await database.post.create({
                data: {
                    title: dto.title,
                    content: dto.content,
                    prev: dto.prev,
                    next: dto.next,
                    draft: dto.draft,
                    summary: dto.summary,
                    // I. 없는 경우 create, 있는 경우 connect, 1대다 이므로 connectOrCreate 가능
                    category: {
                        connectOrCreate: {
                            where: { name: dto.category },
                            create: { name: dto.category },
                        },
                    },
                    author: {
                        connect: { id: user.id },
                    },
                    images: {
                        createMany: {
                            data: dto.images.map((url) => ({ url })),
                        },
                    },
                },
            });

            // I. 태그 생성 및 연결
            // I. 태그가 중복으로 들어왔을 경우 처리해야함
            const set = new Set(dto.tags);
            const tags = [...set];
            for (const tagName of tags) {
                // I. 생성한 태그와 게시글을 연결, 태그가 없으면 생성, 있으면 연결
                // I. createMany 는 사용할 수 없음. => 일대다는 되는데, 다대다에는 제공되지 않음
                // I. createMany works only on a single entity and not on sub-entities.
                await database.postTag.create({
                    data: {
                        post: {
                            connect: { id: post.id },
                        },
                        tag: {
                            connectOrCreate: {
                                where: { name: tagName },
                                create: { name: tagName },
                            },
                        },
                    },
                });
            }

            return post;
        });

        // I. Redis 에서 만료시간 제거
        for (const url of dto.images) {
            const splitUrl = url.split('/uploads')[1];
            const imagePath = 'uploads' + splitUrl;
            await redisClient.del(`image:${imagePath}`);
        }

        return newPost.id;
    }

    async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
        // I. user 가져오기
        const user = await this.usersService.findUserById(userId);
        // I. post 가져오기
        const post = await this.findPostById(postId, { images: true });

        // I. user, post 본인 확인
        if (user.id !== post.authorId) {
            throw new CustomError(
                403,
                'Forbidden',
                '게시글에 대한 권한이 없습니다'
            );
        }

        // I. 게시글 업데이트 트랜젝션
        await database.$transaction(async (database) => {
            // I. images 는 post.id 활용해서 삭제 후 다시 생성
            await database.image.deleteMany({
                where: { postId: post.id },
            });

            // I. tags : post.id 활용해서 postTag 에 있는 놈들 다 삭제
            await database.postTag.deleteMany({
                where: { postId: post.id },
            });

            // I. tags : postTag 새롭게 생성
            // I. 태그가 중복으로 들어왔을 경우 처리해야함
            const set = new Set(dto.tags);
            const tags = [...set];
            for (const tagName of tags) {
                await database.postTag.create({
                    data: {
                        post: {
                            connect: { id: post.id },
                        },
                        tag: {
                            connectOrCreate: {
                                where: { name: tagName },
                                create: { name: tagName },
                            },
                        },
                    },
                });
            }

            await database.post.update({
                where: { id: post.id },
                data: {
                    title: dto.title,
                    content: dto.content,
                    prev: dto.prev,
                    next: dto.next,
                    draft: dto.draft,
                    summary: dto.summary,
                    // I. category 는 post 기능에서 삭제하지 못함, 생성만 가능
                    category: {
                        connectOrCreate: {
                            where: { name: dto.category },
                            create: { name: dto.category },
                        },
                    },
                    images: {
                        createMany: {
                            data: dto.images.map((url) => ({ url })),
                        },
                    },
                    updatedAt: new Date().toISOString(),
                },
            });

            // I. 게시글이 업데이트 되면 고아 태그 삭제
            await database.tag.deleteMany({
                where: {
                    posts: {
                        // none: 관련된 posts: PostTag[] 레코드가 없는 놈
                        none: {},
                    },
                },
            });
        });

        // I. 트렌젝션이 성공하면 기본 이미지와 수정된 이미지를 비교해 사용되지 않는 이미지를 삭제해야 함.
        if (post.images.length > 0) {
            const existingURL = post.images; // DB [{id, url}]
            const newURL = new Set(dto.images); // DTO [string]

            const result = existingURL.filter((obj) => !newURL.has(obj.url));
            try {
                await deleteImages(result);
            } catch (err) {
                throw new CustomError(500, 'Internal Server Error', `${err}`);
            }
        }
        // I. return 값 없음
    }

    async deletePost(userId: string, postId: string) {
        // I. post 가져오기
        const post = await this.findPostById(postId, { images: true });

        // I. user, post 비교해 권한 체크하기
        if (userId !== post.authorId) {
            throw new CustomError(
                403,
                'Forbidden',
                '게시글에 대한 권한이 없습니다'
            );
        }

        // I. 게시글 삭제하기
        await database.post.delete({
            where: { id: post.id },
        });

        // I. 고아 데이터 삭제하기
        await database.tag.deleteMany({
            where: {
                posts: { none: {} },
            },
        });

        // I. 로컬 이미지 삭제하기
        if (post.images.length > 0) {
            try {
                await deleteImages(post.images);
            } catch (err) {
                throw new CustomError(500, 'Internal Server Error', `${err}`);
            }
        }
    }

    async getPosts(
        take: number,
        skip: number,
        search: string,
        category: string
    ) {
        // I. 카테고리 옵션 설정, 있으면 { name : ... } , 없으면 {}
        let categoryOptions = category ? { name: category } : {};

        // I. post search 쿼리(제목, 내용)에 해당하는 게시글 가져오기
        let posts = await database.post.findMany({
            where: {
                OR: [
                    { title: { contains: search } },
                    { content: { contains: search } },
                ],
                category: categoryOptions,
            },
            select: {
                id: true,
                title: true,
                summary: true,
                createdAt: true,
                tags: {
                    select: {
                        tagId: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc', // 내림, 최신순
            },
            skip,
            take,
        });

        // I. 반환값 수정
        const postList = posts.map((post) => {
            const { tags, ...restPost } = post;
            return {
                ...restPost,
                tags: tags.map((tag) => tag.tagId),
            };
        });

        // I. posts, postCount 반환
        return { posts: postList, postCount: posts.length };
    }

    async getPost(postId: string, guestLikeId: string) {
        // I. 게시글 상세 조회
        const post = await database.post.findUnique({
            where: {
                id: postId,
            },
            select: {
                id: true,
                title: true,
                content: true,
                prev: true,
                next: true,
                draft: true,
                summary: true,
                categoryName: true,
                createdAt: true,
                updatedAt: true,
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                tags: {
                    select: {
                        tagId: true,
                    },
                },
                _count: {
                    select: { postLikes: true },
                },
                postLikes: {
                    select: {
                        guestId: true,
                    },
                },
                images: {
                    select: {
                        id: true,
                        url: true,
                    },
                },
                comments: {
                    where: {
                        parentCommentId: null,
                    },
                    select: {
                        id: true,
                        content: true,
                        author: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        guest: {
                            select: {
                                id: true,
                                nickName: true,
                            },
                        },
                        childComments: {
                            select: {
                                id: true,
                                content: true,
                                author: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                                guest: {
                                    select: {
                                        id: true,
                                        nickName: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!post)
            throw new CustomError(
                404,
                'Not Found',
                '게시글을 찾을 수 없습니다'
            );

        // I. 게시글 좋아요 여부
        const isLiked = post.postLikes.some((el) => el.guestId === guestLikeId);

        // I. 반환값 편집
        const {
            postLikes,
            _count: { postLikes: postLikeCount },
            tags,
            ...restPost
        } = post;
        const tagList = tags.map((el) => el.tagId);

        return {
            post: {
                ...restPost,
                tags: tagList,
                postLikeCount,
                isLiked,
            },
        };
    }

    // 게시글 좋아요 ==========================================================================================

    async postLike(dto: PostLikeDto) {
        // [guestLikeId, tryToLike]
        // falsy, false => 잘못된 요청
        // falsy, true => 좋아요 생성(isLiked === null)
        // truthy, true => 좋아요 생성(isLiked === null)
        // truthy, false => 좋아요 삭제(isLiked !== null)

        // I. falsy, false
        if (!dto.guestLikeId && !dto.tryToLike) {
            throw new CustomError(400, 'Bad Request', '잘못된 요청입니다');
        }
        // I. falsy, true
        else if (!dto.guestLikeId && dto.tryToLike) {
            dto.guestLikeId = await this.usersService.createGuestLike();
        }

        // I. 공통 로직(게시글 존재 여부, 게시글 좋아요 유무)
        const post = await this.findPostById(dto.postId);
        const isLiked = await database.postLike.findUnique({
            where: {
                postId_guestId: {
                    postId: post.id,
                    guestId: dto.guestLikeId!,
                },
            },
        });

        // I. 좋아요 생성 시, 백엔드에서도 한 번 더 체킹
        if (dto.tryToLike && !isLiked) {
            // I. GuestLike 가 없으면 에러 발생함
            const guest = await this.usersService.findGuestLikeById(
                dto.guestLikeId!
            );

            await database.postLike.create({
                data: {
                    post: { connect: { id: post.id } },
                    guest: { connect: { id: guest.id } },
                },
            });

            return guest.id;
        }
        // I. 좋아요 삭제 시
        else if (!dto.tryToLike && isLiked) {
            await database.postLike.delete({
                where: {
                    postId_guestId: {
                        postId: post.id,
                        guestId: dto.guestLikeId!,
                    },
                },
            });

            // I. 고아 게스트 삭제
            await database.guestLike.deleteMany({
                where: {
                    postLikes: { none: {} },
                },
            });

            return null;
        }

        throw new CustomError(400, 'Bad Request', '잘못된 요청입니다');
    }

    // 이미지 업로드 ==========================================================================================

    async uploadImage(file: Express.Multer.File | undefined) {
        if (!file) {
            throw new CustomError(400, 'Bad Request', '잘못된 요청입니다');
        }

        const imagePath = file.path;
        const imageKey = `image:${imagePath}`;

        // I. redis expire 1day 설정
        await redisClient.set(imageKey, '', { EX: 60 * 60 * 24 });
        return imagePath;
    }

    /**
     * [Utils]
     * findPostById : 게시글 찾기, Prisma.PostInclude 로 type 해결 ㄷㄷ !
     */
    async findPostById(
        postId: string,
        includeOptions: Prisma.PostInclude = {}
    ) {
        const post = await database.post.findUnique({
            where: { id: postId },
            include: { ...includeOptions },
        });

        if (!post)
            throw new CustomError(
                404,
                'Not Found',
                '게시글을 찾을 수 없습니다'
            );

        return post;
    }
}
