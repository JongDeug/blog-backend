import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'reflect-metadata';
import './loadEnv'; // dotenv 로드
import { Router } from './domain';
import { jwtVerify } from '@middleware';
import { database } from '@utils';

// --- 즉시 실행 함수
(async () => {
    const app = express();
    await database.$connect(); // connect db

    // --- 미들웨어
    app.use(cors({ origin: '*' }));
    app.use(express.json()); // JSON 형식
    app.use(express.urlencoded({ extended: true })); // HTML 폼
    app.use(cookieParser());
    app.use(jwtVerify);
    // ---

    // --- 라우터 등록
    Router.forEach(el => {
        app.use(el.path, el.router);
    });
    //

    // --- 에러 핸들러
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
        res.status(err.status || 500)
            .json({ error: err.message || '서버에서 에러가 발생했습니다.' });
    };
    app.use(errorHandler);
    // ---

    app.listen(process.env.PORT, () => console.log('Server running on port 8000'));
})();
// ---
