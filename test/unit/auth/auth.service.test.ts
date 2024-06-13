import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../../src/singleton';
import { LoginDto, RegisterDto } from '../../../src/domain/auth/dto/dto.index';
import bcrypt from 'bcrypt';
import jwt, { Decoded, Secret } from 'jsonwebtoken';
import '../../../src/loadEnv';
import { User } from '../../../prisma/prisma-client';
import * as process from 'node:process';

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
                return <Decoded>jwt.verify(token, process.env.JWT_SECRET as Secret);
            } catch (err) {
                throw { status: 401, message: '토큰이 만료됐거나 잘못된 토큰입니다' };
            }
        });
    });

    // --- Register
    describe('register', () => {
        let dto: RegisterDto = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };
        let mockUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
        };

        test('should throw error if email already exists', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockUser);

            // when : 방법 1
            let error;
            try {
                await authService.register(dto);
            } catch (err) {
                error = err;
            }
            // when + then : 방법 2
            // await expect(authService.register(dto)).rejects.toEqual({ status: 400, message: '이미 존재하는 이메일 입니다.' });

            // then : 검증
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(error).toEqual({ status: 409, message: '이미 존재하는 이메일 입니다.' });
        });

        test('should create a new user and return access and refresh tokens if email does not exist', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            prismaMock.user.create.mockResolvedValue(mockUser);
            // authService.signToken() : mock 함수로 변형
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.register(dto);

            // then : 에러 메시지 없이 잘 호출 됐다면 유저 생성
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, Number(process.env.PASSWORD_SALT));
            expect(prismaMock.user.create).toHaveBeenCalledWith({ data: { ...dto, password: 'hashedPassword' } });
            expect(authService.signToken).toHaveBeenCalledTimes(2);
            expect(authService.signToken).toHaveBeenCalledWith(mockUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockUser, true);
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        let dto: LoginDto = { email: 'test@gmail.com', password: '12345' };
        let mockUser: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
        };

        test('should throw error if email does not exist', async () => {
            // given, null 을 주었을 "때의" 코드가 잘 실행됨!
            prismaMock.user.findUnique.mockResolvedValue(null);

            // when
            let error;
            try {
                await authService.login(dto);
            } catch (err) {
                error = err;
            }
            // expect(authService.login(dto)).rejects.toEqual({ status: 400, message: '가입되지 않은 이메일 입니다.' });

            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(error).toEqual({ status: 404, message: '가입되지 않은 이메일 입니다.' });
        });

        test('should throw error if the password is incorrect', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            // when
            let error;
            try {
                await authService.login(dto);
            } catch (err) {
                error = err;
            }
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, mockUser.password);
            expect(error).toEqual({ status: 400, message: '비밀번호를 잘못 입력하셨습니다.' });
        });

        test('should return access and refresh tokens if the password is correct', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (authService.signToken as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.login(dto);

            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, mockUser.password);
            expect(authService.signToken).toHaveBeenCalledTimes(2);
            expect(authService.signToken).toHaveBeenCalledWith(mockUser, false);
            expect(authService.signToken).toHaveBeenCalledWith(mockUser, true);
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

        test('should throw error if token type is access', async () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedAccess);

            // when
            let err;
            try {
                authService.refresh(mockToken, false);
            } catch (error) {
                err = error;
            }

            // then
            expect(err).toEqual({ status: 401, message: '토큰 재발급은 refresh 토큰으로만 가능합니다' });
        });

        test('should return a token after validation', () => {
            // given
            (authService.verifyToken as jest.Mock).mockReturnValue(mockDecodedRefresh);
            (authService.signToken as jest.Mock).mockReturnValue('fakeAccessToken');
            // when
            const result = authService.refresh(mockToken, false);
            // then
            expect(result).toEqual('fakeAccessToken');
        });
    });
    // ---

    // --- Utils
    // --- extractTokenFromHeader
    describe('Utils', () => {
        describe('extractTokenFromHeader', () => {
            const mockHeaderUndefined = undefined;
            const mockInvalidHeader = 'Bearer invalid aslkdfjsdflksdjfsdlkfjdsf';
            const mockHeader = 'Bearer sdlkfsjdflkdsfj';

            test('should throw error if header is undefined', () => {
                // when
                let error;
                try {
                    authService.extractTokenFromHeader(mockHeaderUndefined);
                } catch (err) {
                    error = err;
                }
                // then
                expect(error).toEqual({ status: 401, message: '토큰을 보내고 있지 않습니다' });
            });

            test('should throw error if header is weird', () => {
                // when
                let error;
                try {
                    authService.extractTokenFromHeader(mockInvalidHeader);
                } catch (err) {
                    error = err;
                }
                // then
                expect(error).toEqual({ status: 401, message: '잘못된 토큰입니다' });
            });

            test('should return rawToken', () => {
                // when
                const result = authService.extractTokenFromHeader(mockHeader);
                // then
                expect(result).toBeDefined();
                expect(result).toEqual('sdlkfsjdflkdsfj');
            });
        });
    });
    // ---
    // ---
});
