/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  clearMocks: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/singleton.ts'],
  moduleNameMapper: {
    "@utils/(.*)$": "<rootDir>/src/utils/$1",
    "@middleware/(.*)$": "<rootDir>/src/middleware/$1",
    "@prisma": "<rootDir>/prisma/prisma-client/index",
    "@custom-type/(.*)$": "<rootDir>/types/$1"
  }
};
