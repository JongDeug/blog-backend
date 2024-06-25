import { CreatePostDto } from './dto';
import { CustomError, database } from '@utils';
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
                    // I. 없는 경우 create, 있는 경우 connect
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
                // I. 방식 1
                for (const tagName of dto.tags) {
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

}
