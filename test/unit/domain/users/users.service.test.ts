import { prismaMock } from '../../../singleton';
import { GuestUser, User } from '@prisma';
import { CustomError } from '@utils/customError';
import { UsersService } from '../../../../src/domain/users/users.service';

describe('UsersService Util Functions', () => {
    let usersService: UsersService;

    beforeEach(() => {
        usersService = new UsersService();
    });

    // --- FindUserById
    describe('findUserById', () => {
        const mockUserId = 'mockUserId';
        const mockReturnedUser = { id: 'mockUserId' };

        test('should find a user by id successfully', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser as User);
            // when
            const result = await usersService.findUserById(mockUserId);
            // then
            expect(result).toStrictEqual(mockReturnedUser);
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUserId } });
        });

        test('should throw error if user is not found', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(usersService.findUserById(mockUserId)).rejects.toThrow(
                new CustomError(404, 'Not Found', '유저를 찾을 수 없습니다'),
            );
            expect(prismaMock.user.findUnique).toHaveBeenCalled();
        });
    });
    // ---

    // --- CreateGuestUser
    describe('createGuestUser', () => {
        const mockReturnedGuestUser = { id: 'mockGuestUserId' };
        test('should create a guest user', async () => {
            // given
            prismaMock.guestUser.create.mockResolvedValue(mockReturnedGuestUser as GuestUser);
            // when
            const result = await usersService.createGuestUser();
            // then
            expect(result).toStrictEqual(mockReturnedGuestUser.id);
            expect(prismaMock.guestUser.create).toHaveBeenCalledWith({ data: {} });
        });
    });
    // ---
});
