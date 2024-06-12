import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { RegisterDto } from '../../../src/domain/auth/dto/dto.index';
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

    describe('register', () => {
        const mockUser = { name: 'jonghwan', email: 'jong@gmail.com', password: '1234' };

        beforeEach(() => {
            req.body = mockUser;
        });

        test('should call authService.register', async () => {
            await authController.register(req, res, next);
            // expect.any(RegisterDto)는 RegisterDto 클래스의 인스턴스라면 어떤 객체든 허용하겠다는 의미
            expect(authService.register).toHaveBeenCalledWith(expect.any(RegisterDto));
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
});
