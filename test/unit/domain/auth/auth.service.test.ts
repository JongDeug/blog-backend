import { AuthService } from '../../../../src/domain/auth/auth.service';
import { prismaMock } from '../../../singleton';
import { LoginDto, RegisterDto } from '../../../../src/domain/auth/dto';
import bcrypt from 'bcrypt';
import { User } from '@prisma';
import { CustomError } from '@utils/customError';
import jwt, { Secret } from 'jsonwebtoken';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService Main Function', () => {
    let authService: AuthService;
    let mockData: any = {};

    beforeEach(() => {
        authService = new AuthService();
        authService.signToken = jest.fn();
        authService.verifyToken = jest.fn();
        // mock data
        mockData.returnedUser = {
            id: '1234',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: 'mockToken',
        };
        mockData.accessToken = 'mockAccessToken';
        mockData.refreshToken = 'mockRefreshToken';
        mockData.decodedAccess = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'access',
        };
        mockData.decodedRefresh = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'refresh',
        };
    });

    // --- Register
    describe('register', () => {
        beforeEach(() => {
            mockData.registerDto = {
                name: 'jonghwan',
                email: 'jong@gmail.com',
                password: '1234',
            };
        });

        test('should create a new user successfully', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            prismaMock.user.create.mockResolvedValue(mockData.returnedUser);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.register(mockData.registerDto);
            // then
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockData.registerDto.email } });
            expect(bcrypt.hash).toHaveBeenCalledWith(mockData.registerDto.password, Number(process.env.PASSWORD_SALT));
            expect(prismaMock.user.create).toHaveBeenCalledWith({
                data: {
                    ...mockData.registerDto,
                    password: 'hashedPassword',
                },
            });
            expect(authService.signToken).toHaveBeenCalledWith(mockData.returnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockData.returnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockData.returnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if email already exists', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser);
            // when, then
            await expect(authService.register(mockData.returnedUser)).rejects.toThrow(new CustomError(409, 'Conflict', '이미 존재하는 이메일 입니다'));
            // then : 검증
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockData.returnedUser.email } });
            expect(bcrypt.hash).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        beforeEach(() => {
            mockData.loginDto = {
                email: 'test@gmail.com',
                password: '12345',
            };
        });

        test('should login successfully if password is correct', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.login(mockData.loginDto);
            // then
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockData.loginDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockData.loginDto.password, mockData.returnedUser.password);
            expect(authService.signToken).toHaveBeenCalledWith(mockData.returnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockData.returnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockData.returnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if email does not exist', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(authService.login(mockData.loginDto)).rejects.toThrow(new CustomError(404, 'Not Found', '가입되지 않은 이메일 입니다'));
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockData.loginDto.email } });
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should throw error if the password is incorrect', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when, then
            await expect(authService.login(mockData.loginDto)).rejects.toThrow(new CustomError(400, 'Bad Request', '비밀번호를 잘못 입력하셨습니다'));
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockData.loginDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockData.loginDto.password, mockData.returnedUser.password);
            expect(authService.signToken).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Refresh
    describe('refresh', () => {
        test('should refresh JWT tokens successfully', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockData.decodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');
            // when
            const result = await authService.refresh(mockData.refreshToken);
            // then
            expect(result).toStrictEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.refreshToken);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockData.decodedRefresh }, false);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockData.decodedRefresh }, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockData.decodedRefresh.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
        });

        test('should throw error if token verification fails', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockImplementation(() => {
                throw new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다');
            });
            // when, then
            await expect(authService.refresh(mockData.accessToken)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다'),
            );
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.accessToken);
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token type is access', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockData.decodedAccess);
            // when, then
            await expect(authService.refresh(mockData.accessToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '토큰 재발급은 refresh 토큰으로만 가능합니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.accessToken);
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token is different with stored token in database', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockData.decodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when, then
            await expect(authService.refresh(mockData.refreshToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '토큰 유효성 검증에 실패했습니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.refreshToken);
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
                where: {
                    id: mockData.decodedRefresh.id,
                    refreshToken: mockData.refreshToken,
                },
            });
            expect(authService.signToken).not.toHaveBeenCalled();
        });
    });
    // ---

    // --- Logout
    describe('logout', () => {
        test('should logout successfully', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockData.decodedAccess);
            prismaMock.user.findUnique.mockResolvedValue(mockData.returnedUser);
            // when
            await authService.logout(mockData.accessToken);
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.accessToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockData.decodedAccess.id } });
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockData.decodedAccess.id },
                data: { refreshToken: null },
            });
        });

        test('should throw error if token verification fails', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockImplementation(() => {
                throw new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다');
            });
            // when, then
            await expect(authService.logout(mockData.accessToken)).rejects.toThrow(
                new CustomError(401, 'Unauthorized', '토큰이 만료됐거나 잘못된 토큰입니다'),
            );
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.accessToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });

        test('should throw error if token type is refresh', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockData.decodedRefresh);
            // when, then
            await expect(authService.logout(mockData.refreshToken)).rejects.toThrow(new CustomError(401, 'Unauthorized', '로그아웃은 access 토큰으로만 가능합니다'));
            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockData.refreshToken, { ignoreExpiration: true });
            expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        });
    });
});

describe('AuthService Util Function', () => {
    let authService: AuthService;
    let mockData: any = {};

    beforeEach(() => {
        authService = new AuthService();
    });


    // --- SignToken
    describe('signToken', () => {
        beforeEach(() => {
            mockData.user = { id: 'mockUserId', email: 'test@gmail.com' };
        });

        test('should sign access token successfully', () => {
            // given
            (jwt.sign as jest.Mock).mockImplementation(() => 'fakeAccessToken');
            // when
            const result = authService.signToken(mockData.user, false);
            // then
            expect(result).toBe('fakeAccessToken');
            expect(jwt.sign).toHaveBeenCalledWith({
                id: mockData.user.id,
                email: mockData.user.email,
                type: 'access',
            }, process.env.JWT_SECRET as Secret, { expiresIn: '1h' });
        });

        test('should sign refresh token successfully', () => {
            // given
            (jwt.sign as jest.Mock).mockImplementation(() => 'fakeRefreshToken');
            // when
            const result = authService.signToken(mockData.user, true);
            // then
            expect(result).toBe('fakeRefreshToken');
            expect(jwt.sign).toHaveBeenCalledWith({
                id: mockData.user.id,
                email: mockData.user.email,
                type: 'refresh',
            }, process.env.JWT_SECRET as Secret, { expiresIn: '1d' });
        });
    });
    // ---

    // --- VerifyToken
    describe('verifyToken', () => {
        beforeEach(() => {
            mockData.token = 'mockToken';
        });

        test('should verify token successfully without options', () => {
            // given
            (jwt.verify as jest.Mock).mockReturnValue({ id: 'mockUserId' });
            // when
            const result = authService.verifyToken(mockData.token);
            // then
            expect(result).toStrictEqual({ id: 'mockUserId' });
            expect(jwt.verify).toHaveBeenCalledWith(mockData.token, process.env.JWT_SECRET as Secret, {});
        });

        test('should verify token successfully with options', () => {
            // given
            (jwt.verify as jest.Mock).mockReturnValue({ id: 'mockUserId' });
            // when
            const result = authService.verifyToken(mockData.token, { ignoreExpiration: true });
            // then
            expect(result).toStrictEqual({ id: 'mockUserId' });
            expect(jwt.verify).toHaveBeenCalledWith(mockData.token, process.env.JWT_SECRET as Secret, { ignoreExpiration: true });
        });

        test('should throw error if token is expired', () => {
            // given
            const error = new Error('verify 에러');
            error.name = 'TokenExpiredError';
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw error;
            });
            // when, then
            try {
                authService.verifyToken(mockData.token, {});
            } catch (err) {
                expect(err).toStrictEqual(
                    new CustomError(401, 'Unauthorized', '만료된 토큰입니다'),
                );
            }
            expect(jwt.verify).toHaveBeenCalled();
        });

        test('should throw error if token is invalid', () => {
            // given
            const error = new Error('verify 에러');
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw error;
            });
            // when, then
            try {
                authService.verifyToken(mockData.token, {});
            } catch (err) {
                expect(err).toStrictEqual(
                    new CustomError(401, 'Unauthorized', '잘못된 토큰입니다'),
                );
            }
            expect(jwt.verify).toHaveBeenCalled();
        });
    });
    // ---
});
