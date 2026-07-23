import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { validarBaseE2E } from './src/server/testing/e2eDatabaseSafety';

// Los tests hablan con Prisma directamente para preparar cuentas, así que
// necesitan las mismas variables que la app.
const rutaEnv = path.join(__dirname, '.env');
if (existsSync(rutaEnv)) {
  process.loadEnvFile(rutaEnv);
}

const validacionBaseE2E = validarBaseE2E({
  e2eDatabaseUrl: process.env.E2E_DATABASE_URL,
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  permiteMutaciones: process.env.E2E_ALLOW_DB_MUTATION === 'true',
  databaseIdPermitida: process.env.E2E_DATABASE_ID,
});
if (!validacionBaseE2E.ok) {
  throw new Error(
    `Los E2E están bloqueados para proteger la base de datos. ${validacionBaseE2E.motivo}`,
  );
}
const E2E_DATABASE_URL = validacionBaseE2E.databaseUrl;

// Prisma (en los workers) y Next.js (en webServer) reciben únicamente la base
// dedicada. DATABASE_URL nunca se usa como fallback para un E2E destructivo.
process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.DIRECT_URL = E2E_DATABASE_URL;

const PUERTO = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: './e2e',
  // Los tests comparten una base de datos: en paralelo se pisarían entre sí.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // En CI se prueba el build de producción; en local, el servidor de desarrollo.
    command: process.env.CI ? `npx next start -p ${PUERTO}` : `npx next dev -p ${PUERTO}`,
    url: BASE_URL,
    // No reutilizar un servidor que pudiera haberse iniciado contra otra base.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_URL: BASE_URL,
      DATABASE_URL: E2E_DATABASE_URL,
      DIRECT_URL: E2E_DATABASE_URL,
    },
  },
});
