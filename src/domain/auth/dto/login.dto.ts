import { User } from '../../../../prisma/prisma-client';

export class LoginDto {
    email: string;
    password: string;

    constructor(props: Pick<User, 'email' | 'password'>) {
        this.email = props.email;
        this.password = props.password;
    }
}
