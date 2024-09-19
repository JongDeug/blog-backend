/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    clearMocks: true,
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/test/singleton.ts'],
    moduleNameMapper: {
        // 절대 경로
        '@utils/(.*)$': '<rootDir>/src/utils/$1',
        '@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '@custom-type/(.*)$': '<rootDir>/src/types/$1',
    },
    coveragePathIgnorePatterns: [
        // coverage 무시
        '/prisma/',
        '/dist/',
    ],
};
