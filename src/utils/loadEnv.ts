import dotenv from 'dotenv';
import { CustomError } from '@utils/customError';

dotenv.config();

const requiredEnvs = ['DATABASE_PWD', 'DATABASE_PORT', 'DATABASE_URL', 'PORT', 'JWT_SECRET', 'MAIL_ID', 'MAIL_PWD', 'PASSWORD_SALT'];
requiredEnvs.forEach(key => {
    if (!process.env[key]) {
        throw new CustomError(500, 'Internal Server Error', '환경 변수가 필요합니다')
    }
});
