import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'reflect-metadata';
import '@utils/loadEnv'; // dotenv 로드
import { Router } from './domain';
import { jwtVerify } from '@middleware/jwtVerify';
import database from '@utils/database';
import redisClient from '@utils/redis';
import * as path from 'node:path';
import { AuthService } from './domain/auth/auth.service';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import basicAuth from 'express-basic-auth';
import { redisListener } from '@utils/redisListener';

// --- 즉시 실행 함수
(async () => {
    const app = express();
    await redisClient.connect(); // connect redis
    await redisClient.configSet('notify-keyspace-events', 'Ex'); // set event
    await database.$connect(); // connect db

    // --- Redis 이미지 만료 이벤트 관리
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    await subscriber.subscribe('__keyevent@0__:expired', redisListener);
    // ---

    // --- Swagger
    const swaggerSpec = YAML.load(path.join(__dirname, '../swagger.yaml'));
    app.use(
        '/docs',
        basicAuth({
            users: { admin: '1234' },
            challenge: true,
        }),
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
            swaggerOptions: {
                url: '/api/docs/swagger.yaml',
            },
        }),
    );
    // ---

    // --- 미들웨어
    app.use(cors({
        origin: 'https://jongdeug.port0.org',
        credentials: true,
    }));
    app.use(express.json()); // JSON 형식
    app.use(express.urlencoded({ extended: true })); // HTML 폼
    app.use(cookieParser());
    app.use(jwtVerify(new AuthService()));
    // ---

    // --- 라우터 등록
    Router.forEach((el) => {
        app.use(`${el.path}`, el.router);
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
        console.log(`Server running on port ${process.env.PORT}`),
    );

})();
// ---
