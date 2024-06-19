import { User } from '../prisma/prisma-client';

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
