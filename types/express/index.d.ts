import { User } from '../prisma/prisma-client';
import { PaginationType } from '../customPagination';

// I. Express.Request 에 user 타입 추가
declare global {
    namespace Express {
        interface Request {
            user?: User;
            pagination: PaginationType;
        }
    }
}
