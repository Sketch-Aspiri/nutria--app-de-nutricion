/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/test-utils/**', '!src/index.ts'],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
