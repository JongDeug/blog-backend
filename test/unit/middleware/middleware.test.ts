import httpMocks from 'node-mocks-http';
import { NextFunction, Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { User } from '@prisma';
import * as process from 'node:process';
import { prismaMock } from '../../singleton';
import { jwtVerify } from '@middleware';

jest.mock('jsonwebtoken');

describe('Middleware', () => {
    let req: httpMocks.MockRequest<Request>;
    let res: httpMocks.MockResponse<Response>;
    let next: NextFunction;


    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        next = jest.fn();
    });

    describe('jwtVerify', () => {
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

        beforeEach(() => {
            req.cookies.accessToken = 'fakeAccessToken';
            req.url = '/post';
        });

        test('should pass the middleware if url starts with "/auth"', () => {
            // given
            req.url = '/auth/login';
            // when
            jwtVerify(req, res, next);
            // then
            expect(next).toHaveBeenCalled();
        });

        test('should throw error if token does not exist', async () => {
            // given
            req.cookies.accessToken = null;
            // when
            jwtVerify(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith({ status: 401, message: '토큰을 보내고 있지 않습니다' });
        });

        // 의존성 때문에 에러 났었음.
        test('should throw error if token is invalid', () => {
            // given
            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw { message: 'mock error' };
            });
            // when
            jwtVerify(req, res, next);
            // given
            expect(jwt.verify).toHaveBeenCalledWith(req.cookies.accessToken, process.env.JWT_SECRET as Secret);
            expect(next).toHaveBeenCalledWith({ status: 401, message: '토큰이 만료됐거나 잘못된 토큰입니다' });
        });

        test('should throw error if token type is refresh', async () => {
            // given
            (jwt.verify as jest.Mock).mockReturnValue(mockDecodedRefresh);
            // when
            jwtVerify(req, res, next);
            // then
            expect(next).toHaveBeenCalledWith({ status: 401, message: '서비스 이용은 access 토큰으로만 가능합니다' });
        });

        test('should throw error if user does not exist', async () => {
            // given
            (jwt.verify as jest.Mock).mockReturnValue(mockDecodedAccess);
            prismaMock.user.findUnique.mockResolvedValue(null);
            // when
            await jwtVerify(req, res, next);
            // then
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockDecodedAccess!.id } });
            expect(next).toHaveBeenCalledWith({ status: 404, message: '유저를 찾을 수 없습니다' });
        });

        test('should store user at req.user', async () => {
            (jwt.verify as jest.Mock).mockReturnValue(mockDecodedAccess);
            prismaMock.user.findUnique.mockResolvedValue(mockReturnedUser);
            // when
            await jwtVerify(req, res, next);
            // then
            expect(req.user).toStrictEqual(mockReturnedUser);
            expect(next).toHaveBeenCalled();
        });
    });
});
