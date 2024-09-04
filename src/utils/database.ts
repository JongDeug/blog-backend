import { PrismaClient } from '../../prisma/prisma-client';

// I. 쿼리를 보기 위해서 옵션 설정
const prisma = new PrismaClient({ log: ['info', 'warn'] });

export default prisma;
