import { prismaMock } from '../../../singleton';
import { User } from '@prisma';
import { CustomError } from '@utils/customError';
import { UsersService } from '../../../../src/domain/users/users.service';

describe('UsersService Util Functions', () => {
    let usersService: UsersService;
    let mockData: any = {};

    beforeEach(() => {
        usersService = new UsersService();
    });

    // --- FindUserById
    describe('findUserById', () => {
        beforeEach(() => {
            mockData.userId = 'mockUserId';
            mockData.returnedUser = { id: 'mockUserId' };
        });

        test('should find a user by id successfully', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser as User);
            // when
            const result = await usersService.findUserById(mockData.userId);
            // then
            expect(result).toStrictEqual(mockData.returnedUser);
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockData.userId } });
        });

        test('should throw error if user is not found', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(usersService.findUserById(mockData.userId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(prismaMock.user.findUnique).toHaveBeenCalled();
        });
    });
    // ---

    // --- createGuestForLike
    describe('createGuestForLike', () => {
        beforeEach(() => {
            mockData.returnedGuest = { id: 'mockGuestId' };
        });

        test('should create a guest for like', async () => {
            // given
            prismaMock.guestLike.create.mockResolvedValue(mockData.returnedGuest);
            // when
            const result = await usersService.createGuestForLike();
            // then
            expect(result).toStrictEqual(mockData.returnedGuest.id);
            expect(prismaMock.guestLike.create).toHaveBeenCalledWith({ data: {} });
        });
    });
    // ---

    // --- createGuestForComment
    describe('createGuestForComment', () => {
        beforeEach(() => {
            mockData.returnedGuest = {
                id: 'mockGuestId',
                nickName: 'mockNickName',
                email: 'mockEmail',
                password: 'mockPassword',
            };
        });

        test('should create a guest for comment', async () => {
            // given
            prismaMock.guestComment.create.mockResolvedValue(mockData.returnedGuest);
            // when
            const result = await usersService.createGuestForComment('mockNickName', 'mockEmail', 'mockPassword');
            // then
            expect(result).toStrictEqual(mockData.returnedGuest);
            expect(prismaMock.guestComment.create).toHaveBeenCalledWith({
                data: {
                    nickName: mockData.returnedGuest.nickName,
                    email: mockData.returnedGuest.email,
                    password: mockData.returnedGuest.password,
                },
            });
        });
    });
    // ---
});
