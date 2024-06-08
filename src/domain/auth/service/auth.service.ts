import { PrismaClient, User } from '../../../../prisma/prisma-client';

export class AuthService {
    constructor(private readonly authRepository: PrismaClient) {

    }
}
