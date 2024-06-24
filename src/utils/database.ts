import { PrismaClient } from '@prisma';

// I. 쿼리를 보기 위해서 옵션 설정
const prisma = new PrismaClient({ log: ['query', 'info', 'warn'] });

export default prisma;
