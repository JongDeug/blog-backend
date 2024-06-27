import { CreatePostDto, UpdatePostDto } from './dto';
import { CustomError } from '@utils/customError';
import database from '@utils/database';
import { deleteImage } from '@utils/filesystem';
import { AuthService } from '../auth/auth.service';

export class PostsService {
    constructor(private readonly authService: AuthService) {
    }

    async createPost(userId: string, dto: CreatePostDto) {
        // I. user 찾기, user 가 없다면 에러 반환
        const user = await this.authService.findUserById(userId);

        // I. 트랜젝션을 통해 중간에 실패해도 롤백할 수 있음.
        const newPost = await database.$transaction(async (database) => {
            // I. 게시글 생성
            const post = await database.post.create({
                data: {
                    title: dto.title,
                    content: dto.content,
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
                            data: dto.images.map(image => ({ url: image.path })),
                        },
                    },
                },
            });

            // I. 태그 생성 및 연결
            if (dto.tags) {
                // I. 태그가 중복으로 들어왔을 경우 처리해야함
                const set = new Set(dto.tags);
                const tags = [...set];
                for (const tagName of tags) {
                    // I. 생성한 태그와 게시글을 연결, 태그가 없으면 생성, 있으면 연결
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
            }

            return post;
        });

        return newPost.id;
    }

    async updatePost(userId: string, postId: string, dto: UpdatePostDto) {
        // I. user 가져오기
        const user = await this.authService.findUserById(userId);
        // I. post 가져오기
        const post = await database.post.findUnique({
            where: { id: postId },
            include: {
                images: true,
            },
        });
        if (!post) throw new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다');

        // I. user, post 본인 확인
        if (user.id !== post.authorId) {
            throw new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다');
        }

        // I. 게시글 업데이트 트랜젝션
        await database.$transaction(async (database) => {
            // I. images 는 post.id 활용해서 삭제 후 다시 createMany(post.update)
            await database.image.deleteMany({
                where: { postId: post.id },
            });

            // I. tags : post.id 활용해서 postTag 에 있는 놈들 다 삭제
            await database.postTag.deleteMany({
                where: { postId: post.id },
            });

            // I. tags : postTag 새롭게 생성
            if (dto.tags) {
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
            }

            await database.post.update({
                where: { id: post.id },
                data: {
                    title: dto.title,
                    content: dto.content,
                    // I. category 는 post 기능에서 삭제하지 못함, 생성만 가능
                    category: {
                        connectOrCreate: {
                            where: { name: dto.category },
                            create: { name: dto.category },
                        },
                    },
                    images: {
                        createMany: {
                            data: dto.images.map(image => ({ url: image.path })),
                        },
                    },
                    updatedAt: dto.updatedAt,
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

        // I. 트랜젝션이 성공하면 로컬 파일에 존재했던 이전 이미지 또한 지워야 함.
        if (post.images.length > 0) {
            try {
                const result = await deleteImage(post.images);
                console.log(result);
            } catch (err) {
                console.log(`이미지 파일 삭제 오류: ${err}`);
            }
        }

        // I. return 값 없음
    }

    async deletePost(userId: string, postId: string) {
        // I. post 가져오기
        const post = await database.post.findUnique({ where: { id: postId } });
        if (!post) throw new CustomError(404, 'Not Found', '게시글을 찾을 수 없습니다');

        // I. user, post 비교해 권한 체크하기
        if (userId !== post.authorId) {
            throw new CustomError(403, 'Forbidden', '게시글에 대한 권한이 없습니다');
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
        // I. 게시글 수정에서 이미지가 어차피 onUpdate : CASCADE 니까 deleteMany를 하지 않아도 될듯함 다시보자고
    }
}
