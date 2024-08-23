import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { validateDto } from '@middleware/validateDto';
import { CustomError } from '@utils/customError';

export class AuthController {
    public path: string;
    public router: Router;

    // 의존성 역전 원칙을 통해 의존도를 낮춤 => 테스트 코드를 더 쉽게 작성할 수 있게 됨
    constructor(private readonly authService: AuthService) {
        this.router = Router();
        this.path = '/api/auth';
        this.init();
    }

    init() {
        this.router.post('/register', validateDto(RegisterDto), this.register);
        this.router.post('/login', validateDto(LoginDto), this.login);
        this.router.get('/refresh', this.refresh);
        this.router.get('/logout', this.logout);
    }

    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. authService.register 에 req.body 넘기기
            const { accessToken, refreshToken } =
                await this.authService.register(req.body);

            // I. Http Only Cookie 를 사용해 토큰 전송
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                maxAge: 3 * 60 * 1000, // 3분
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });

            // I. 201: Created
            res.status(201).json({ message: '회원가입 성공' });
        } catch (err) {
            next(err);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. authService.login 에 req.body 넣기
            const { accessToken, refreshToken } = await this.authService.login(
                req.body
            );

            // I. Http Only Cookie 를 사용해 토큰 전송
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                maxAge: 3 * 60 * 1000, // 3분
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });

            // I. 로그인 성공
            res.status(200).json({ message: '로그인 성공' });
        } catch (err) {
            next(err);
        }
    };

    refresh = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. refresh token 이 없으면 에러 발생
            const token = req.cookies.refreshToken;
            if (!token)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '토큰을 보내고 있지 않습니다'
                    )
                );

            // I. cookie-parser 을 통해 refresh 토큰 추출
            const { accessToken, refreshToken } =
                await this.authService.refresh(token);

            // I. Http Only Cookie 를 사용해 토큰 전송
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                maxAge: 3 * 60 * 1000, // 3분
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
                // sameSite: 'strict', // sameSite 속성 설정
                // secure: true // HTTPS 연결에서만 쿠키가 전송되도록 설정
            });

            // I. 인증 갱신 성공
            res.status(200).json({ message: '인증 갱신 성공' });
        } catch (err) {
            next(err);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // I. access token 이 없으면 에러 발생
            const token = req.cookies.accessToken;
            if (!token)
                return next(
                    new CustomError(
                        401,
                        'Unauthorized',
                        '토큰을 보내고 있지 않습니다'
                    )
                );

            // I. authService logout 호출 => DB refresh 를 null 로 만듦
            await this.authService.logout(token); // req.cookies?. 이것도 분기문에 속함

            // I. cookie 데이터 삭제
            res.cookie('accessToken', null);
            res.cookie('refreshToken', null);

            // I. 응답
            res.status(200).json({ message: '로그아웃 완료' });
        } catch (err) {
            next(err);
        }
    };
}

export default new AuthController(new AuthService());
