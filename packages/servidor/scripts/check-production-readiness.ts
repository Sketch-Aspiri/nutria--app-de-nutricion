import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function add(name: string, ok: boolean, detail: string): void {
  checks.push({ name, ok, detail });
}

function present(name: string, minimum = 1): string | null {
  const value = process.env[name]?.trim() ?? '';
  add(name, value.length >= minimum, value.length >= minimum ? 'configurada' : 'faltante');
  return value || null;
}

function validHttps(name: string): URL | null {
  const value = present(name);
  if (!value) return null;
  try {
    const url = new URL(value);
    const ok = url.protocol === 'https:';
    add(`${name} usa HTTPS`, ok, ok ? 'correcto' : 'debe usar https://');
    return ok ? url : null;
  } catch {
    add(`${name} es una URL válida`, false, 'formato inválido');
    return null;
  }
}

function main(): void {
  present('DATABASE_URL');
  present('DIRECT_URL');
  present('AUTH_SECRET', 32);
  const authUrl = validHttps('AUTH_URL');
  const appUrl = validHttps('APP_URL');
  add(
    'AUTH_URL y APP_URL coinciden',
    Boolean(authUrl && appUrl && authUrl.origin === appUrl.origin),
    authUrl && appUrl && authUrl.origin === appUrl.origin
      ? 'mismo origen'
      : 'configura el mismo origen productivo',
  );

  const encryptionKey = present('ENCRYPTION_KEY');
  let keyBytes = 0;
  if (encryptionKey) {
    try {
      keyBytes = Buffer.from(encryptionKey, 'base64').length;
    } catch {
      keyBytes = 0;
    }
  }
  add(
    'ENCRYPTION_KEY tiene 32 bytes',
    keyBytes === 32,
    keyBytes === 32 ? 'correcto' : 'genera una clave base64 de 32 bytes',
  );
  present('ENCRYPTION_KEY_ID');
  present('UPSTASH_REDIS_REST_URL');
  present('UPSTASH_REDIS_REST_TOKEN');
  present('RATE_LIMIT_HASH_KEY', 32);
  present('SENTRY_DSN');
  present('NEXT_PUBLIC_SENTRY_DSN');
  present('RESEND_API_KEY');
  present('EMAIL_FROM');
  present('CRON_SECRET', 32);
  present('PRIVACY_RESPONSIBLE_NAME');
  present('PRIVACY_RESPONSIBLE_ADDRESS');
  present('PRIVACY_CONTACT_EMAIL');
  present('OFF_USER_AGENT');

  const cachePath = path.join(
    import.meta.dirname,
    '..',
    'prisma',
    'seed',
    'off',
    'alimentos-off.json',
  );
  let offTotal = 0;
  if (existsSync(cachePath)) {
    const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as { total?: number };
    offTotal = cache.total ?? 0;
  }
  add(
    'Tanda 3 de Open Food Facts',
    offTotal === 300,
    offTotal === 300 ? '300 productos versionados' : `${offTotal}/300 productos versionados`,
  );

  if ((process.env.BILLING_MODE ?? 'beta') === 'produccion') {
    present('STRIPE_SECRET_KEY');
    present('STRIPE_WEBHOOK_SECRET');
    present('STRIPE_PRICE_PRO_MENSUAL');
    present('STRIPE_PRICE_PRO_ANUAL');
    present('STRIPE_PRICE_CLINICA_MENSUAL');
  } else {
    add('Cobro durante pilotos', true, 'BILLING_MODE=beta; no se cobran suscripciones');
  }

  for (const check of checks) {
    console.info(`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`);
  }
  const failures = checks.filter((check) => !check.ok);
  console.info(`\nResultado: ${checks.length - failures.length}/${checks.length} controles listos.`);
  if (failures.length > 0) process.exitCode = 2;
}

main();
