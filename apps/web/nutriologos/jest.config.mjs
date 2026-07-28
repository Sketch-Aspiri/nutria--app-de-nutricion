import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Los specs de `e2e/` los corre Playwright, no Jest.
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  // Desde la fase 1, la capa de servidor y sus tests viven en
  // `packages/servidor` con su propio umbral. Aquí solo queda UI, que se apoya
  // más en Playwright que en cobertura de líneas. Ver `rules/testing.md`.
  coverageThreshold: {
    global: { lines: 45 },
  },
  moduleNameMapper: {
    // Mismo orden de búsqueda que el `paths` de tsconfig.json: primero el `src`
    // de la app, luego la capa de servidor compartida.
    '^@/(.*)$': [
      '<rootDir>/src/$1',
      '<rootDir>/../../../packages/servidor/src/$1',
    ],
    // Se resuelve al código fuente para que SWC lo transpile en tests.
    '^@nutria/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@nutria/ui-tokens$': '<rootDir>/../../../packages/ui-tokens/src/index.ts',
  },
};

export default createJestConfig(config);
