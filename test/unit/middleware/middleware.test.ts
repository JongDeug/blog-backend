import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import { User } from '@prisma';
import { jwtVerify } from '@middleware/jwtVerify';
import { AuthService } from '../../../src/domain/auth/auth.service';
import { CustomJwtPayload } from '@custom-type/customJwtPayload';
import { CustomError } from '@utils';

jest.mock('../../../src/domain/auth/auth.service');

describe('Middleware', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;
    let authServiceMock: jest.Mocked<AuthService>;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
        authServiceMock = jest.mocked(new AuthService()) as jest.Mocked<AuthService>;
    });

    // --- JwtVerify
    describe('jwtVerify', () => {
        const mockAccessToken = 'fakeAccessToken';
        const mockRefreshToken = 'fakeRefreshToken';
        const mockDecodedAccess: CustomJwtPayload = {
            id: '1234',
            email: 'test@gmail.com',
            type: 'access',
        };
        const mockDecodedRefresh: CustomJwtPayload = {
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

        beforeEach(() => {
            req.cookies.accessToken = mockAccessToken;
            req.url = '/post';
        });

        test('should pass the middleware if URL starts with /auth', () => {
            // given
            req.url = '/auth/login';
            // when
            const middleware = jwtVerify(authServiceMock);
            middleware(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith();
            expect(authServiceMock.verifyToken).not.toHaveBeenCalled();
        });

        test('should verify JWT access token successfully', async () => {
            // given
            authServiceMock.verifyToken.mockReturnValue(mockDecodedAccess);
            authServiceMock.findUserById.mockResolvedValue(mockReturnedUser);
            // when
            const middleware = jwtVerify(authServiceMock);
            await middleware(req, res, next);
            // then
            expect(req.user).toStrictEqual(mockReturnedUser);
            expect(authServiceMock.verifyToken).toHaveBeenCalledWith(mockAccessToken);
            expect(authServiceMock.findUserById).toHaveBeenCalledWith(mockDecodedAccess.id);
            expect(next).toHaveBeenCalledWith();
        });

        test('should throw error if accessToken is missing', () => {
            // given
            req.cookies.accessToken = null;
            // when
            const middleware = jwtVerify(authServiceMock);
            middleware(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith((new CustomError(401, 'Unauthorized', '토큰을 보내고 있지 않습니다')));
            expect(authServiceMock.verifyToken).not.toHaveBeenCalled();
        });

        test('should handle error if authService.verifyToken throw error', () => {
            // given
            authServiceMock.verifyToken.mockImplementation(() => {
                throw new Error('verifyToken 함수에서 던지는 오류');
            });
            // when
            const middleware = jwtVerify(authServiceMock);
            middleware(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('verifyToken 함수에서 던지는 오류'));
        });

        test('should throw error if token type is refresh', () => {
            // given
            authServiceMock.verifyToken.mockReturnValue(mockDecodedRefresh);
            // when
            const middleware = jwtVerify(authServiceMock);
            middleware(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith((new CustomError(401, 'Unauthorized', '서비스 이용은 access 토큰으로만 가능합니다')));
            expect(authServiceMock.findUserById).not.toHaveBeenCalled();
        });

        test('should handle error if authService.findUserById throw error', () => {
            // given
            authServiceMock.verifyToken.mockReturnValue(mockDecodedAccess);
            authServiceMock.findUserById.mockImplementation(() => {
                throw new Error('findUserById 함수에서 던지는 오류');
            });
            // when
            const middleware = jwtVerify(authServiceMock);
            middleware(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith(new Error('findUserById 함수에서 던지는 오류'));
            expect(authServiceMock.verifyToken).toHaveBeenCalled();
            expect(authServiceMock.findUserById).toHaveBeenCalled();
        });
    });
    // ---
});
