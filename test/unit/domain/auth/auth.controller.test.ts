import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../../../src/domain/auth/auth.service';
import { AuthController } from '../../../../src/domain/auth/auth.controller';
import { CustomError } from '@utils/customError';

jest.mock('../../../../src/domain/auth/auth.service'); // AuthService mocking

describe('AuthController', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;
    let authController: AuthController;
    let authServiceMock: jest.Mocked<AuthService>;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
        authServiceMock = jest.mocked(new AuthService()) as jest.Mocked<AuthService>;
        authController = new AuthController(authServiceMock); // authService DI 를 통해 쉽게 테스트 가능해짐
    });

    // --- Register
    describe('register', () => {
        beforeEach(() => {
            req.body = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };
        });

        test('should create a new user successfully', async () => {
            // given
            authServiceMock.register.mockResolvedValue({
                accessToken: 'fakeAccessToken',
                refreshToken: 'fakeRefreshToken',
            });
            // when
            await authController.register(req, res, next);
            // then
            expect(res.cookies).toHaveProperty('accessToken');
            expect(res.cookies).toHaveProperty('refreshToken');
            expect(res.cookies.accessToken.value).toEqual('fakeAccessToken');
            expect(res.cookies.refreshToken.value).toEqual('fakeRefreshToken');
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({ message: '회원가입 성공' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(authServiceMock.register).toHaveBeenCalledWith(req.body);
        });

        test('should handle errors if authService.register throws error', async () => {
            // given
            authServiceMock.register.mockRejectedValue(new Error('register 함수에서 던지는 오류'));
            // when
            await authController.register(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('register 함수에서 던지는 오류'));
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        beforeEach(() => {
            req.body = { email: 'test@gmail.com', password: '12345' };
        });

        test('should login successfully if password is correct', async () => {
            // given
            authServiceMock.login.mockResolvedValue({
                accessToken: 'fakeAccessToken',
                refreshToken: 'fakeRefreshToken',
                username: 'mockUsername',
                role: 200,
            });
            // when
            await authController.login(req, res, next);
            // then
            expect(res.cookies).toHaveProperty('accessToken');
            expect(res.cookies).toHaveProperty('refreshToken');
            expect(res.cookies.accessToken.value).toEqual('fakeAccessToken');
            expect(res.cookies.refreshToken.value).toEqual('fakeRefreshToken');
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ username: 'mockUsername', role: 200 });
            expect(res._isEndCalled()).toBeTruthy();
            expect(authServiceMock.login).toHaveBeenCalledWith(req.body);
        });

        test('should handle errors if authService.login throws error', async () => {
            // given
            authServiceMock.login.mockRejectedValue(new Error('login 함수에서 던지는 오류'));
            // when
            await authController.login(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('login 함수에서 던지는 오류'));
        });
    });
    // ---

    // --- Refresh
    describe('refresh', () => {
        beforeEach(() => {
            req.cookies.refreshToken = 'fakeRefreshToken';
        });

        test('should refresh JWT tokens successfully', async () => {
            // given
            authServiceMock.refresh.mockResolvedValue({
                accessToken: 'fakeAccessToken',
                refreshToken: 'fakeRefreshToken',
            });
            // when
            await authController.refresh(req, res, next);
            // then
            expect(res.cookies).toHaveProperty('refreshToken');
            expect(res.cookies).toHaveProperty('accessToken');
            expect(res.cookies.accessToken.value).toEqual('fakeAccessToken');
            expect(res.cookies.refreshToken.value).toEqual('fakeRefreshToken');
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ message: '인증 갱신 성공' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(authServiceMock.refresh).toHaveBeenCalledWith(req.cookies.refreshToken);
        });

        test('should handle error if refreshToken is missing', async () => {
            // given
            req.cookies.refreshToken = undefined;
            // when
            await authController.refresh(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '토큰을 보내고 있지 않습니다'));
        });

        test('should handle error if authService.refresh throws error', async () => {
            // given
            authServiceMock.refresh.mockRejectedValue(new Error('refresh 함수에서 던지는 오류'));
            // when
            await authController.refresh(req, res, next);
            // then: error 던지는지만 확인하면 됨
            expect(next).toHaveBeenCalledWith(new Error('refresh 함수에서 던지는 오류'));
        });
    });
    // ---

    // --- Logout
    describe('logout', () => {
        beforeEach(() => {
            req.cookies.accessToken = 'fakeAccessToken';
        });

        test('should logout successfully', async () => {
            // when
            await authController.logout(req, res, next);
            // then
            expect(res.cookies).toHaveProperty('accessToken');
            expect(res.cookies).toHaveProperty('refreshToken');
            expect(res.cookies.accessToken.value).toBe(null);
            expect(res.cookies.refreshToken.value).toBe(null);
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toEqual({ message: '로그아웃 완료' });
            expect(res._isEndCalled()).toBeTruthy();
            expect(authServiceMock.logout).toHaveBeenCalledWith(req.cookies.accessToken);
        });

        test('should handle error if accessToken is missing', async () => {
            // given
            req.cookies.accessToken = undefined;
            // when
            await authController.logout(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new CustomError(401, 'Unauthorized', '토큰을 보내고 있지 않습니다'));
        });

        test('should handle error if authService.logout throws error', async () => {
            // given
            authServiceMock.logout.mockRejectedValue(new Error('logout 함수에서 던지는 오류'));
            // when
            await authController.logout(req, res, next);
            // then: error 던지는지만 확인하면 됨
            expect(next).toHaveBeenCalledWith(new Error('logout 함수에서 던지는 오류'));
        });
    });
    // ---
});
