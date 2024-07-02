import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../singleton';
import { LoginDto, RegisterDto } from '../../../src/domain/auth/dto';
import bcrypt from 'bcrypt';
import { User } from '@prisma';
import { CustomError } from '@utils/customError';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        authService = new AuthService();
        authService.signToken = jest.fn();
        authService.verifyToken = jest.fn();
    });

    // Util 함수 mock 해제
    afterEach(() => {
        (authService.signToken as jest.Mock).mockRestore();
        (authService.verifyToken as jest.Mock).mockRestore();
    });

    // --- Register
    describe('register', () => {
        let mockDto: RegisterDto = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };
        let mockReturnedUser = { id: '1', email: 'jong@gmail.com' } as User;

        test('should create a new user successfully', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            prismaMock.user.create.mockResolvedValue(mockReturnedUser);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.register(mockDto);
            // then
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.hash).toHaveBeenCalledWith(mockDto.password, Number(process.env.PASSWORD_SALT));
            expect(prismaMock.user.create).toHaveBeenCalledWith({ data: { ...mockDto, password: 'hashedPassword' } });
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockReturnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if email already exists', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            // when, then
            await expect(authService.register(mockDto)).rejects.toThrow(new CustomError(409, 'Conflict', '이미 존재하는 이메일 입니다'));
            // then : 검증
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.hash).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        let mockDto: LoginDto = { email: 'test@gmail.com', password: '12345' };
        let mockReturnedUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: null,
        };

        test('should login successfully if password is correct', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.login(mockDto);
            // then
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockDto.password, mockReturnedUser.password);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockReturnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if email does not exist', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(authService.login(mockDto)).rejects.toThrow(new CustomError(404, 'Not Found', '가입되지 않은 이메일 입니다'));
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if the password is incorrect', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when, then
            await expect(authService.login(mockDto)).rejects.toThrow(new CustomError(400, 'Bad Request', '비밀번호를 잘못 입력하셨습니다'));
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockDto.password, mockReturnedUser.password);
            expect(authService.signToken).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Refresh
    describe('refresh', () => {
        const mockAccessToken = 'mockAccessToken';
        const mockRefreshToken = 'mockRefreshToken';
        const mockDecodedAccess = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'access',
        };
        const mockDecodedRefresh = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'refresh',
        };
        const mockReturnedUser: User = {
            id: '1234',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: 'mockToken',
        };

        test('should refresh JWT tokens successfully', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.refresh(mockRefreshToken);
            // then
            expect(result).toStrictEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(authService.verifyToken).toHaveBeenCalledWith(mockRefreshToken);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockDecodedRefresh }, false);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockDecodedRefresh }, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockDecodedRefresh.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if token verification fails', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockImplementation(() => {
                throw new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다');
            });
            // when, then
            await expect(authService.refresh(mockAccessToken)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다'),
            );
            expect(authService.verifyToken).toHaveBeenCalledWith(mockAccessToken);
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token type is access', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedAccess);
            // when, then
            await expect(authService.refresh(mockAccessToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '토큰 재발급은 refresh 토큰으로만 가능합니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockAccessToken);
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token is different with stored token in database', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(authService.refresh(mockRefreshToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '토큰 유효성 검증에 실패했습니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockRefreshToken);
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
                where: {
                    id: mockDecodedRefresh.id,
                    refreshToken: mockRefreshToken,
                },
            });
            expect(authService.signToken).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Logout
    describe('logout', () => {
        const mockAccessToken = 'fakeAccessToken';
        const mockRefreshToken = 'fakeRefreshToken';
        const mockDecodedAccess = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'access',
        };
        const mockDecodedRefresh = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'refresh',
        };
        const mockReturnedUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: null,
        };

        test('should logout successfully', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedAccess);
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            // when
            await authService.logout(mockAccessToken);
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockAccessToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockDecodedAccess.id } });
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockDecodedAccess.id },
                data: { refreshToken: null },
            });
        });

        test('should throw error if token verification fails', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockImplementation(() => {
                throw new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다');
            });
            // when, then
            await expect(authService.logout(mockAccessToken)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다'),
            );
            expect(authService.verifyToken).toHaveBeenCalledWith(mockAccessToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token type is refresh', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            // when, then
            await expect(authService.logout(mockRefreshToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '로그아웃은 access 토큰으로만 가능합니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockRefreshToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });
    });


    // --- Utils
    describe('utils', () => {

    });
    // ---
});
