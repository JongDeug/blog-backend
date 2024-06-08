import { PrismaClient } from '../../../../prisma/prisma-client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let authService: AuthService;
    let authRepository: jest.Mocked<PrismaClient>;

    beforeEach(() => {
        authService = new AuthService(authRepository);
        authRepository = new PrismaClient() as jest.Mocked<PrismaClient>;
    });

    test('test', () => {

    })
});
