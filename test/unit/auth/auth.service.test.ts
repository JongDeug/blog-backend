import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../singleton';
import { LoginDto, RegisterDto } from '../../../src/domain/auth/dto';
import bcrypt from 'bcrypt';
import jwt, { Secret } from 'jsonwebtoken';
import { User } from '@prisma';
import { CustomJwtPayload } from '@custom-type/customJwtPayload';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        authService = new AuthService();
        authService.signToken = jest.fn().mockImplementation((user, isRefreshToken) => {
            const payload = {
                id: user.id,
                email: user.email,
                type: isRefreshToken ? 'refresh' : 'access',
            };
            return jwt.sign(payload, 'mocked-secret', {
                expiresIn: isRefreshToken ? '1d' : '2h',
            });
        });
        authService.verifyToken = jest.fn().mockImplementation(token => {
            try {
                return <CustomJwtPayload>jwt.verify(token, process.env.JWT_SECRET as Secret);
            } catch (err) {
                throw { status: 401, message: '토큰이 만료됐거나 잘못된 토큰입니다' };
            }
        });
    });

    // --- Register
    describe('register', () => {
        let mockDto: RegisterDto = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };
        let mockReturnedUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: null,
        };

        test('should throw error if email already exists', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);

            // when : 방법 1
            let error;
            try {
                await authService.register(mockDto);
            } catch (err) {
                error = err;
            }
            // when + then : 방법 2
            // await expect(authService.register(dto)).rejects.toEqual({ status: 400, message: '이미 존재하는 이메일 입니다.' });

            // then : 검증
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockReturnedUser.email } });
            expect(error).toEqual({ status: 409, message: '이미 존재하는 이메일 입니다.' });
        });

        test('should create a new user and return access and refresh tokens if email does not exist', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            prismaMock.user.create.mockResolvedValue(mockReturnedUser);
            // authService.signToken() : mock 함수로 변형
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.register(mockDto);

            // then : 에러 메시지 없이 잘 호출 됐다면 유저 생성
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.hash).toHaveBeenCalledWith(mockDto.password, Number(process.env.PASSWORD_SALT));
            expect(prismaMock.user.create).toHaveBeenCalledWith({ data: { ...mockDto, password: 'hashedPassword' } });
            expect(authService.signToken).toHaveBeenCalledTimes(2);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockReturnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
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

        test('should throw error if email does not exist', async () => {
            // given, null 을 주었을 "때의" 코드가 잘 실행됨!
            prismaMock.user.findUnique.mockResolvedValue(null);

            // when
            let error;
            try {
                await authService.login(mockDto);
            } catch (err) {
                error = err;
            }
            // expect(authService.login(dto)).rejects.toEqual({ status: 400, message: '가입되지 않은 이메일 입니다.' });

            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(error).toEqual({ status: 404, message: '가입되지 않은 이메일 입니다.' });
        });

        test('should throw error if the password is incorrect', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when
            let error;
            try {
                await authService.login(mockDto);
            } catch (err) {
                error = err;
            }
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockDto.password, mockReturnedUser.password);
            expect(error).toEqual({ status: 400, message: '비밀번호를 잘못 입력하셨습니다.' });
        });

        test('should return access and refresh tokens if the password is correct', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.login(mockDto);

            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: mockDto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(mockDto.password, mockReturnedUser.password);
            expect(authService.signToken).toHaveBeenCalledTimes(2);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockReturnedUser, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockReturnedUser.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
        });
    });
    // ---

    // --- Refresh
    describe('refresh', () => {
        const mockToken = 'mockToken';
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

        test('should throw error if token does not exist', async () => {
            // when, then
            expect(authService.refresh(undefined)).rejects.toEqual({ status: 401, message: '토큰을 보내고 있지 않습니다' });
        });

        test('should throw error if token type is access', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedAccess);

            // when
            let err;
            try {
                await authService.refresh(mockToken);
            } catch (error) {
                err = error;
            }

            // then
            expect(authService.verifyToken).toHaveBeenCalledWith(mockToken);
            expect(err).toEqual({ status: 401, message: '토큰 재발급은 refresh 토큰으로만 가능합니다' });
        });

        test('should throw error if token is different with stored token in database', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(null);

            // when
            let err;
            try {
                await authService.refresh(mockToken);
            } catch (error) {
                err = error;
            }

            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
                where: {
                    id: mockDecodedRefresh.id,
                    refreshToken: mockToken,
                },
            });
            expect(err).toEqual({ status: 401, message: '토큰 유효성 검증에서 실패했습니다' });
        });

        test('should return tokens after validation', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.refresh(mockToken);

            // then
            expect(authService.signToken).toHaveBeenCalledTimes(2);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockDecodedRefresh }, false);
            expect(authService.signToken).toHaveBeenCalledWith({ ...mockDecodedRefresh }, true);
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockDecodedRefresh.id },
                data: { refreshToken: 'fakeRefreshToken' },
            });
            expect(result).toStrictEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        const mockAccessToken = 'fakeAccessToken';
        const mockDecodedAccess = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'access',
        };
        const mockReturnedUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
            refreshToken: null,
        };

        test('should throw error if token does not exist', async () => {
            // when, then
            expect(authService.logout(undefined)).rejects.toEqual({ status: 401, message: '토큰을 보내고 있지 않습니다' });
        });

        test('should throw error if token is invalid', async () => {
            // given
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw { status: 401, message: '잘못된 토큰입니다' };
            });

            // when
            let error;
            try {
                await authService.logout(mockAccessToken);
            } catch (err) {
                error = err;
            }

            // then
            expect(jwt.verify).toHaveBeenCalledWith(mockAccessToken, process.env.JWT_SECRET as Secret, { ignoreExpiration: true });
            expect(error).toEqual({ status: 401, message: '잘못된 토큰입니다' });
        });

        test('should update the stored refresh token to null if the user exists', async () => {
            // given
            (jwt.verify as jest.Mock).mockReturnValue(mockDecodedAccess);
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            // when
            await authService.logout(mockAccessToken);
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockDecodedAccess.id } });
            expect(prismaMock.user.update).toHaveBeenCalledWith({
                where: { id: mockDecodedAccess.id },
                data: { refreshToken: null },
            });
        });
    });

    // --- Utils
    describe('Utils', () => {
    });
    // ---
});
