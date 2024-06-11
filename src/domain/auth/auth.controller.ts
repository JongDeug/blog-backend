import { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/dto.index';

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
        this.router.use('/register', this.register.bind(this));
    }

    async register(req: Request, res: Response, next: NextFunction) {
        try {
            // I. authService.register 에 req.body 넘기기
            const { accessToken, refreshToken } = await this.authService.register(
                new RegisterDto(req.body),
            );
            // I. accessToken, requestToken response 로 넘기기, 201: Created
            res.status(201).json({ accessToken, refreshToken });
        } catch (err) {
            next(err);
        }
    };
}

export default new AuthController(new AuthService());
