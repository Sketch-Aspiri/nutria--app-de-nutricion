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

/**
 * Playwright vuelve a evaluar esta configuración dentro de cada worker, y el
 * worker hereda la env que este mismo archivo ya modificó. Si la validación
 * leyera `DATABASE_URL` ahí, se estaría comparando contra sí misma y siempre
 * denunciaría un empalme. Las conexiones reales de la app se preservan en la
 * primera evaluación para que la comprobación siga siendo la misma en ambos
 * procesos.
 */
process.env.E2E_APP_DATABASE_URL ??= process.env.DATABASE_URL ?? '';
process.env.E2E_APP_DIRECT_URL ??= process.env.DIRECT_URL ?? '';

const validacionBaseE2E = validarBaseE2E({
  e2eDatabaseUrl: process.env.E2E_DATABASE_URL,
  databaseUrl: process.env.E2E_APP_DATABASE_URL,
  directUrl: process.env.E2E_APP_DIRECT_URL,
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

/**
 * Correo y cron en los E2E (fase 6).
 *
 * El buzón sustituye a Resend: los recordatorios se anexan a un archivo que
 * los tests leen, en vez de mandarle correo real a nadie. El secreto de cron
 * se fija aquí para que la ruta programada exista en el entorno de prueba; sin
 * él respondería 503 y el flujo del recordatorio no se podría ejercitar.
 */
const BUZON_CORREO = path.join(__dirname, 'test-results', 'buzon-correo.jsonl');
const CRON_SECRET_E2E = process.env.CRON_SECRET ?? 'cron-secreto-e2e';
process.env.EMAIL_OUTBOX_FILE = BUZON_CORREO;
process.env.CRON_SECRET = CRON_SECRET_E2E;

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
      EMAIL_OUTBOX_FILE: BUZON_CORREO,
      CRON_SECRET: CRON_SECRET_E2E,
    },
  },
});
