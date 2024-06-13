import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/dto.index';
import { validateDto } from '../../middleware/middleware.index';

export class AuthController {
    public path: string;
    public router: Router;

    // 의존성 역전 원칙을 통해 의존도를 낮춤 => 테스트 코드를 더 쉽게 작성할 수 있게 됨
    constructor(private readonly authService: AuthService) {
        this.router = Router();
        this.path = '/auth';
        this.init();
    }

    init() {
        this.router.post('/register', validateDto(RegisterDto), this.register.bind(this));
        this.router.post('/login', validateDto(LoginDto), this.login.bind(this));
        this.router.post('/refresh', this.refresh.bind(this));
    }

    async register(req: Request, res: Response, next: NextFunction) {
        try {
            // I. authService.register 에 req.body 넘기기
            const { accessToken, refreshToken } = await this.authService.register(req.body);
            // I. accessToken, requestToken response 로 넘기기, 201: Created
            res.status(201).json({ accessToken, refreshToken });
        } catch (err) {
            next(err);
        }
    };

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            // I. authService.login 에 req.body 넣기
            const { accessToken, refreshToken } = await this.authService.login(req.body);
            // I. 반환된 토큰 넘겨주기
            res.status(200).json({ accessToken, refreshToken });
        } catch (err) {
            next(err);
        }
    };

    refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const { wantRefreshToken } = req.body;

            // I. Header 에서 토큰 추출
            const header = req.headers.authorization || (req.headers.Authorization as string);
            const token = this.authService.extractTokenFromHeader(header);

            // I. 추출된 토큰으로 refresh
            const newToken = this.authService.refresh(token, wantRefreshToken);

            // I. 새로운 토큰 반환
            res.status(200).json({ newToken });
        } catch (err) {
            next(err);
        }
    }
}

export default new AuthController(new AuthService());
