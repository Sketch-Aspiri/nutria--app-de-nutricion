/**
 * Este paquete no es una app de Next, así que no puede usar `next/jest`: ese
 * preset aborta si no encuentra un directorio `app/` o `pages/`. Se transpila
 * con ts-jest, igual que `packages/shared`, sin agregar dependencias nuevas.
 */
/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/prisma'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // El tsconfig del paquete deja el JSX sin transformar para Next; en los
        // tests sí hay que compilarlo, y a CommonJS para que Jest lo cargue.
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          isolatedModules: true,
        },
        // El type-check es un paso propio (`npm run type-check`); repetirlo aquí
        // solo duplicaría el costo de cada corrida.
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Se resuelve al código fuente para que se transpile junto con los tests.
    '^@nutria/shared$': '<rootDir>/../shared/src/index.ts',
    '^@nutria/ui-tokens$': '<rootDir>/../ui-tokens/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/types/**'],
  coverageThreshold: {
    global: { lines: 60 },
  },
};
