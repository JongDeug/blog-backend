import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'reflect-metadata';
import '@utils/loadEnv'; // dotenv 로드
import { Router } from './domain';
import { jwtVerify } from '@middleware/jwtVerify';
import database from '@utils/database';
import * as path from 'node:path';
import { AuthService } from './domain/auth/auth.service';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// --- 즉시 실행 함수
(async () => {
    const app = express();
    await database.$connect(); // connect db

    // --- Swagger
    const swaggerSpec = YAML.load(
        path.join(__dirname, '../swagger.yaml')
    );
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    // ---

    // --- 미들웨어
    app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); // src 폴더가 포함돼서 ../로 뺌
    app.use(cors({ origin: '*' }));
    app.use(express.json()); // JSON 형식
    app.use(express.urlencoded({ extended: true })); // HTML 폼
    app.use(cookieParser());
    app.use(jwtVerify(new AuthService()));
    // 정적 파일 제공 설정
    // ---

    // --- 라우터 등록
    Router.forEach((el) => {
        app.use(el.path, el.router);
    });
    //

    // --- 에러 핸들러
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        res.status(err.status || 500).json({
            error: err.message || '서버에서 에러가 발생했습니다',
        });
    };
    app.use(errorHandler);
    // ---

    app.listen(process.env.PORT, () =>
        console.log(`Server running on port ${process.env.PORT}`)
    );
})();
// ---
