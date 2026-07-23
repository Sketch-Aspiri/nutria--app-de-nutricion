import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Los specs de `e2e/` los corre Playwright, no Jest.
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  coverageThreshold: {
    global: { lines: 60 },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Se resuelve al código fuente para que SWC lo transpile en tests.
    '^@nutria/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@nutria/ui-tokens$': '<rootDir>/../../packages/ui-tokens/src/index.ts',
  },
};

export default createJestConfig(config);
