import { PrismaClient } from '@prisma';
import { mockReset, mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { database } from '@utils';

// [싱글톤 패턴 적용] => Prisma 에만src
// 복잡성이 낮은 간단한 게시판 프로젝트이므로
// DI(Dependency Injection) 패턴 보다
// Singleton 패턴이 적합하다고 생각함.

// [jest-mock-extended]
// mockDeep: 객체의 모든 속성을 재귀적으로 모의
// DeepMockProxy: mockDeep 함수로 생성된 모의 객체 타입

jest.mock('./utils/database', () => ({
    __esModule: true,
    default: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
});

export const prismaMock = database as unknown as DeepMockProxy<PrismaClient>;

