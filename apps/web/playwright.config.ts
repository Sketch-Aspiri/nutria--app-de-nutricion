import { existsSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Los tests hablan con Prisma directamente para preparar cuentas, así que
// necesitan las mismas variables que la app.
const rutaEnv = path.join(__dirname, '.env');
if (existsSync(rutaEnv)) {
  process.loadEnvFile(rutaEnv);
}

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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AUTH_URL: BASE_URL },
  },
});
