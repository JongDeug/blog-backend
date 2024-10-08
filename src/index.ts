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
import morgan from 'morgan';
import helmet from 'helmet';
import fs from 'fs';


// --- 즉시 실행 함수
(async () => {
    const app = express();
    await redisClient.connect(); // connect redis
    await database.$connect(); // connect db
    await redisClient.configSet('notify-keyspace-events', 'Ex'); // set event

    // --- Redis 이미지 만료 이벤트 관리
    const subscriber = redisClient.duplicate();
    await subscriber.connect();
    await subscriber.subscribe('__keyevent@0__:expired', redisListener);
    // ---


    // --- 미들웨어
    // --- Helmet
    app.use(helmet());
    // --- Morgan 로깅
    const accessLogStream = fs.createWriteStream(path.join(__dirname, '../access.log'), { flags: 'a' });
    if (process.env.NODE_ENV === 'production') {
        app.use(morgan('combined', { stream: accessLogStream }));
    } else {
        app.use(morgan('tiny', { stream: accessLogStream }));
    }
    // --- Swagger
    const swaggerSpec = YAML.load(path.join(__dirname, '../swagger.yaml'));
    app.use(
        '/docs',
        basicAuth({
            users: { admin: '1234' },
            challenge: true,
        }),
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec),
    );
    // --- CORS
    app.use(
        cors({
            origin: 'https://jongdeug.port0.org',
            credentials: true,
        }),
    );
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
