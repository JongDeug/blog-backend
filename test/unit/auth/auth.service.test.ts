import { AuthService } from '../../../src/domain/auth/auth.service';
import { prismaMock } from '../../../src/singleton';
import { RegisterDto } from '../../../src/domain/auth/dto/dto.index';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import '../../../src/loadEnv';
import { User } from '../../../prisma/prisma-client';

jest.mock('bcrypt')
jest.mock('jsonwebtoken');

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        authService = new AuthService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- Register
    describe('register', () => {
        let dto: RegisterDto = new RegisterDto({ name: 'jonghwan', email: 'jong@gmail.com', password: '1234' });
        let user: User = {
            id: '1',
            name: 'jonghwan',
            email: 'jong@gmail.com',
            password: 'hashedPassword',
            description: 'hello',
        };

        test('should throw error if email already exists', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue({ id: '#1234', ...dto });

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
            expect(error).toEqual({ status: 400, message: '이미 존재하는 이메일 입니다.' });
        });

        test('should create a new user if email does not exist', async () => {
            // given
            prismaMock.user.findUnique.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            prismaMock.user.create.mockResolvedValue(user);
            // 1번째 호출 : fakeAccessToken, 2번째 호출: fakeRefreshToken, 3번째 호출: undefined
            (jwt.sign as jest.Mock).mockReturnValueOnce('fakeAccessToken').mockReturnValueOnce('fakeRefreshToken');

            // when
            const result = await authService.register(dto);

            // then : 에러 메시지 없이 잘 호출 됐다면 유저 생성
            expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
            expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, Number(process.env.PASSWORD_SALT));
            expect(prismaMock.user.create).toHaveBeenCalledWith({ data: { ...dto, password: 'hashedPassword' } });
            expect(jwt.sign).toHaveBeenCalledTimes(2);
            expect(jwt.sign).toHaveBeenCalledWith({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
            expect(result).toEqual({ accessToken: 'fakeAccessToken', refreshToken: 'fakeRefreshToken' });
        });
    });
    // ---
});
