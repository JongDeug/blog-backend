import { prismaMock } from '../../../singleton';
import { User } from '../../../../prisma/prisma-client';
import { CustomError } from '@utils/customError';
import { UsersService } from '../../../../src/domain/users/users.service';
import prisma from '../../../../src/utils/database';

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

    // --- FindGuestLikeById
    describe('findGuestLikeById', () => {
        beforeEach(() => {
            mockData.guestLikeId = 'mockGuestLikeId';
        });

        test('should get a guestLike successfully', async () => {
            // given
            prismaMock.guestLike.findUnique.mockResolvedValue({ id: 'mockGuestLikeId' });
            // when
            const result = await usersService.findGuestLikeById(mockData.guestLikeId);
            // then
            expect(result).toStrictEqual({ id: 'mockGuestLikeId' });
            expect(prismaMock.guestLike.findUnique).toHaveBeenCalledWith({ where: { id: mockData.guestLikeId } });
        });

        test('should throw error if guest is not found', async () => {
            // given
            prismaMock.guestLike.findUnique.mockResolvedValue(null);
            // when, then
            await expect(usersService.findGuestLikeById(mockData.guestLikeId)).rejects.toThrow(
                new CustomError(404, 'Not Found', 'guestLikeId 를 찾을 수 없습니다'),
            );
            expect(prismaMock.guestLike.findUnique).toHaveBeenCalled();
        });
    });
    // ---

    // --- CreateGuestLike
    describe('createGuestLike', () => {
        beforeEach(() => {
            mockData.returnedGuest = { id: 'mockGuestId' };
        });

        test('should create a guest for like', async () => {
            // given
            prismaMock.guestLike.create.mockResolvedValue(mockData.returnedGuest);
            // when
            const result = await usersService.createGuestLike();
            // then
            expect(result).toStrictEqual(mockData.returnedGuest.id);
            expect(prismaMock.guestLike.create).toHaveBeenCalledWith({ data: {} });
        });
    });
    // ---

    // --- CreateGuestComment
    describe('createGuestComment', () => {
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
            const result = await usersService.createGuestComment('mockNickName', 'mockEmail', 'mockPassword');
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
