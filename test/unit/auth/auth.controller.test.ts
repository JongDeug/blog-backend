import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { LoginDto, RegisterDto } from '../../../src/domain/auth/dto/dto.index';
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
        const body = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };

        beforeEach(() => {
            req.body = body;
        });

        test('should call authService.register', async () => {
            await authController.register(req, res, next);
            // expect.any(RegisterDto)는 RegisterDto 클래스의 인스턴스라면 어떤 객체든 허용하겠다는 의미
            expect(authService.register).toHaveBeenCalledWith(req.body);
        });

        test('should register a user and return access and refresh tokens', async () => {
            // given
            authService.register.mockResolvedValue({
                accessToken: 'mockAccessToken',
                refreshToken: 'mockRefreshToken',
            });
            // when
            await authController.register(req, res, next);
            // then
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()).toStrictEqual({
                accessToken: 'mockAccessToken',
                refreshToken: 'mockRefreshToken',
            });
            expect(res._isEndCalled()).toBeTruthy();
        });

        test('should handle errors properly', async () => {
            // given
            const error = { status: 400, message: '이미 존재하는 이메일 입니다.' };
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
        const body = { email: 'test@gmail.com', password: '12345' };

        beforeEach(() => {
            req.body = body;
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
                accessToken: 'mockAccessToken',
                refreshToken: 'mockRefreshToken',
            });
            // when
            await authController.login(req, res, next);
            // then
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toStrictEqual({
                accessToken: 'mockAccessToken',
                refreshToken: 'mockRefreshToken',
            });
            expect(res._isEndCalled()).toBeTruthy();
        });

        test('should handle errors properly', async () => {
            // given
            const error = { status: 400, message: '비밀번호를 잘못 입력하셨습니다.' };
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
