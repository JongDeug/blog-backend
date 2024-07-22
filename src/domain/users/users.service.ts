import database from '@utils/database';
import { CustomError } from '@utils/customError';

export class UsersService {
    /**
     * Utils
     * findUserById : userId 로 user 검색
     * createGuestLike : guestLike 생성 및 id 반환
     * createGuestComment: guestComment 생성 및 반환
     */
    async findUserById(userId: string) {
        const user = await database.user.findUnique({ where: { id: userId } });

        if (!user) throw new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다');

        return user;
    }

    async createGuestLike() {
        const guest = await database.guestLike.create({ data: {} });
        return guest.id;
    }

    async createGuestComment(nickName: string, email: string, password: string) {
        return database.guestComment.create({
            data: { nickName, email, password },
        });
    }
}
