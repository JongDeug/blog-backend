import { Router } from 'express';
import { AuthService } from '../service/auth.service';

class AuthController {
    public path: string;
    public router: Router;
    private authService: AuthService;

    constructor() {
        this.router = Router();
        this.path = '/auth';
        this.authService = new AuthService();
        this.init();
    }

    init() {

    }
}

export default new AuthController();
