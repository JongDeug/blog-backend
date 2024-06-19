/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  clearMocks: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/singleton.ts'],
  moduleNameMapper: {
    "@utils": "<rootDir>/src/utils/index",
    "@middleware": "<rootDir>/src/middleware/index",
    "@prisma": "<rootDir>/prisma/prisma-client/index",
    "@custom-type/(.*)": "<rootDir>/types/*"
  }
};
