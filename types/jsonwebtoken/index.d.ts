// import jwt from 'jsonwebtoken';
//
// // I. Decoded interface 생성
// declare global {
//     declare module 'jsonwebtoken' {
//         export interface Decoded extends jwt.JwtPayload {
//             id: string;
//             email: string;
//             type: 'refresh' | 'access';
//         }
//     }
// }
//

// export type customJwtPayload = JwtPayload & { id: string, email: string, type: 'refresh' | 'access' }

import { JwtPayload } from 'jsonwebtoken';

declare module 'jsonwebtoken' {
    export interface CustomJwtPayload extends JwtPayload {
        id: string;
        email: string;
        type: 'refresh' | 'access';
    }
}
