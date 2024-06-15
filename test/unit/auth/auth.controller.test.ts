import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { AuthController } from '../../../src/domain/auth/auth.controller';

jest.mock('../../../src/domain/auth/auth.service'); // AuthService mocking

describe('AuthController', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;
    let authController: AuthController;
    let authService: jest.Mocked<AuthService>;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
        authService = jest.mocked(new AuthService()) as jest.Mocked<AuthService>;
        authController = new AuthController(authService); // authService DI 를 통해 쉽게 테스트 가능해짐
    });

    // --- Register
    describe('register', () => {
        const mockBody = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };

        beforeEach(() => {
            req.body = mockBody;
        });

        test('should call authService.register', async () => {
            // when
            await authController.register(req, res, next);
            // then
            expect(authService.register).toHaveBeenCalledWith(req.body);
        });

        test('should register a user and return access and refresh tokens by http only cookies', async () => {
            // given
            authService.register.mockResolvedValue({
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
        });

        test('should handle errors properly', async () => {
            // given
            const error = { status: 400, message: '에러 테스트' };
            authService.register.mockRejectedValue(error);
            // when
            await authController.register(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(error);
        });
    });
    // ---

    // --- Login
    describe('login', () => {
        const mockBody = { email: 'test@gmail.com', password: '12345' };

        beforeEach(() => {
            req.body = mockBody;
        });

        test('should call authService.login', async () => {
            // when
            await authController.login(req, res, next);
            // then
            expect(authService.login).toHaveBeenCalledWith(req.body);
        });

        test('should return access and refresh tokens', async () => {
            // given
            authService.login.mockResolvedValue({
                accessToken: 'fakeAccessToken',
                refreshToken: 'fakeRefreshToken',
            });
            // when
            await authController.login(req, res, next);
            // then
            expect(res.cookies).toHaveProperty('accessToken');
            expect(res.cookies).toHaveProperty('refreshToken');
            expect(res.cookies.accessToken.value).toEqual('fakeAccessToken');
            expect(res.cookies.refreshToken.value).toEqual('fakeRefreshToken');
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ message: '로그인 성공' });
            expect(res._isEndCalled()).toBeTruthy();
        });

        test('should handle errors properly', async () => {
            // given
            const error = { status: 400, message: '에러 테스트' };
            authService.login.mockRejectedValue(error);
            // when
            await authController.login(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(error); // next(err)가 던저져야 한다.
        });
    });
    // ---

    // --- Refresh
    describe('refresh', () => {

        beforeEach(() => {
            req.body = { wantRefreshToken: false };
            req.headers.authorization = 'Bearer sdfksldfsjdf';
        });

        test('should call authService.extractTokenFromHeader and authService.refresh', () => {
            // given
            (authService.extractTokenFromHeader as jest.Mock).mockReturnValue('sdfksldfsjdf');
            // when
            authController.refresh(req, res, next);
            // then
            expect(authService.extractTokenFromHeader).toHaveBeenCalledWith(req.headers.authorization);
            expect(authService.refresh).toHaveBeenCalledWith('sdfksldfsjdf', req.body.wantRefreshToken);
        });

        test('should return newToken', () => {
            // given
            (authService.extractTokenFromHeader as jest.Mock).mockReturnValue('sdfksldfsjdf');
            (authService.refresh as jest.Mock).mockReturnValue('fakeNewToken');

            // when
            authController.refresh(req, res, next);

            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({ newToken: 'fakeNewToken' });
            expect(res._isEndCalled()).toBeTruthy();
        });

        test('should handle errors properly', () => {
            // given, 이미 service 단에서 시나리오에 맞게 에러를 던지는 것을 확인했으니 여기서는 next 로 error 던지는 것만 확인하면됨
            const error = { status: 401, message: '토큰 재발급은 refresh 토큰으로만 가능합니다' };
            authService.refresh.mockImplementation(() => {
                throw error;
            });
            // when
            authController.refresh(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(error);
        });
    });
    // ---
});
