import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  // Solo API en esta fase: los handlers corren en Node, no en el DOM. La
  // fase 6 añadirá jsdom cuando entren componentes.
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  coverageThreshold: {
    global: { lines: 70 },
  },
  moduleNameMapper: {
    // Mismo orden de búsqueda que el `paths` de tsconfig.json: primero el `src`
    // de la app, luego la capa de servidor compartida.
    '^@/(.*)$': ['<rootDir>/src/$1', '<rootDir>/../../../packages/servidor/src/$1'],
    // Se resuelve al código fuente para que SWC lo transpile en tests.
    '^@nutria/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
};

export default createJestConfig(config);
