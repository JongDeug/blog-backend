import { User } from '../../../../prisma/prisma-client';

export class RegisterDto{
    name: string;
    email: string;
    password: string;
    description: string | null;

    constructor(user: Partial<Pick<User, 'name' | 'email' | 'password' | 'description'>>) {
        this.name = user.name!;
        this.email = user.email!;
        this.password = user.password!;
        this.description = user.description ?? null;
    }
}

