import { User } from '../prisma/prisma-client';

// I. Express.Request 에 user 타입 추가
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
