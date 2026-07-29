import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  // Node, no jsdom. La fase 6 trajo componentes, pero son cascarón: enlaces,
  // estados vacíos y clases de Tailwind. Su única lógica —qué pestaña se
  // enciende— está extraída como función pura (`esRutaActiva`) y se prueba
  // aquí mismo. El jsdom entra en la fase 7, con los formularios de registro,
  // que sí tienen interacción que probar.
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
