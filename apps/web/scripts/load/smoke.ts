import { performance } from 'node:perf_hooks';

import { objetivoCargaPermitido } from '../../src/server/load-safety';

type Sample = { durationMs: number; ok: boolean };

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) ? Math.min(Math.max(value, min), max) : fallback;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(index, 0)]!;
}

async function request(url: string, cookie?: string): Promise<Sample> {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers: cookie ? { Cookie: cookie } : undefined,
      signal: AbortSignal.timeout(5_000),
    });
    return { durationMs: performance.now() - startedAt, ok: response.status === 200 };
  } catch {
    return { durationMs: performance.now() - startedAt, ok: false };
  }
}

async function runScenario(
  name: string,
  url: string,
  concurrency: number,
  durationSeconds: number,
  cookie?: string,
): Promise<boolean> {
  const samples: Sample[] = [];
  const deadline = performance.now() + durationSeconds * 1_000;

  async function worker(): Promise<void> {
    while (performance.now() < deadline) {
      samples.push(await request(url, cookie));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const failed = samples.filter((sample) => !sample.ok).length;
  const failureRate = samples.length > 0 ? failed / samples.length : 1;
  const p95 = percentile(
    samples.map((sample) => sample.durationMs),
    95,
  );
  const limit = name === 'health' ? 500 : 1_000;
  const passed = failureRate < 0.01 && p95 < limit;
  console.info(
    `${passed ? '✓' : '✗'} ${name}: ${samples.length} solicitudes, ` +
      `${(failureRate * 100).toFixed(2)}% error, p95 ${p95.toFixed(0)} ms.`,
  );
  return passed;
}

async function main(): Promise<void> {
  const baseUrl = process.env.LOAD_TEST_URL ?? 'http://localhost:3000';
  const safety = objetivoCargaPermitido(
    baseUrl,
    process.env.LOAD_TEST_ALLOW_REMOTE === 'true',
  );
  if (!safety.permitido) throw new Error(safety.motivo);

  const durationSeconds = integerEnv('LOAD_DURATION_SECONDS', 60, 5, 300);
  const healthConcurrency = integerEnv('LOAD_HEALTH_VUS', 20, 1, 100);
  const panelConcurrency = integerEnv('LOAD_PANEL_VUS', 10, 1, 50);
  const sessionCookie = process.env.LOAD_TEST_SESSION_COOKIE?.trim();

  const results = [
    await runScenario(
      'health',
      `${baseUrl}/api/v1/health`,
      healthConcurrency,
      durationSeconds,
    ),
  ];
  if (sessionCookie) {
    results.push(
      await runScenario(
        'panel',
        `${baseUrl}/api/v1/patients`,
        panelConcurrency,
        durationSeconds,
        sessionCookie,
      ),
    );
  } else {
    console.info('– panel: omitido; LOAD_TEST_SESSION_COOKIE no está configurada.');
  }

  if (results.some((passed) => !passed)) process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'La prueba de carga falló.');
  process.exitCode = 1;
});
