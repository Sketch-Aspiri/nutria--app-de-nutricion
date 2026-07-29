import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

import { logger } from './logger';
import { pseudonymizeRateLimitKey } from './rate-limit-key';

type WindowState = { count: number; expiresAt: number };
type LimitResult = {
  permitido: boolean;
  reintentarEnSegundos: number;
  distribuido: boolean;
};

const localWindows = new Map<string, WindowState>();
const distributedLimiters = new Map<string, Ratelimit>();
const TEST_DATABASE_MARKER = /(^|[-_.])(test|preview|branch)([-_.]|$)/i;
const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function databaseIdentity(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null;

    const database = decodeURIComponent(url.pathname.replace(/^\/+/, '')).toLowerCase();
    const host = url.hostname.toLowerCase();
    if (!host || !database) return null;
    return `${host}:${url.port || '5432'}/${database}`;
  } catch {
    return null;
  }
}

/**
 * El runner E2E puede usar el limitador en memoria aun sirviendo un build de
 * producción, pero solo contra una base local, aislada y habilitada de forma
 * explícita. Cualquier configuración incompleta conserva el cierre seguro.
 */
function allowsLocalRateLimitInE2E(): boolean {
  if (
    process.env.CI !== 'true' ||
    process.env.E2E_RATE_LIMIT_MODE !== 'local' ||
    process.env.E2E_ALLOW_DB_MUTATION !== 'true'
  ) {
    return false;
  }

  const e2eIdentity = databaseIdentity(process.env.E2E_DATABASE_URL);
  const appIdentity = databaseIdentity(process.env.DATABASE_URL);
  if (!e2eIdentity || e2eIdentity !== appIdentity) return false;

  const [host, database] = e2eIdentity.split('/', 2);
  const hostname = (host?.replace(/:\d+$/, '') ?? '').replace(/^\[|\]$/g, '');
  return LOCAL_DATABASE_HOSTS.has(hostname) && TEST_DATABASE_MARKER.test(database ?? '');
}

function localRateLimit(key: string, maxRequests: number, windowMs: number): LimitResult {
  const now = Date.now();
  const current = localWindows.get(key);

  if (!current || current.expiresAt <= now) {
    if (localWindows.size >= 10_000) {
      for (const [identifier, state] of localWindows) {
        if (state.expiresAt <= now) localWindows.delete(identifier);
      }
      if (localWindows.size >= 10_000) {
        return {
          permitido: false,
          reintentarEnSegundos: Math.ceil(windowMs / 1000),
          distribuido: false,
        };
      }
    }
    localWindows.set(key, { count: 1, expiresAt: now + windowMs });
    return {
      permitido: true,
      reintentarEnSegundos: 0,
      distribuido: false,
    };
  }

  if (current.count >= maxRequests) {
    return {
      permitido: false,
      reintentarEnSegundos: Math.ceil((current.expiresAt - now) / 1000),
      distribuido: false,
    };
  }

  current.count += 1;
  return {
    permitido: true,
    reintentarEnSegundos: 0,
    distribuido: false,
  };
}

function hasUpstashConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function distributedLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const configKey = `${maxRequests}:${windowMs}`;
  const existing = distributedLimiters.get(configKey);
  if (existing) return existing;

  const duration = `${windowMs} ms` as `${number} ms`;
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(maxRequests, duration),
    // Analytics de Upstash conserva identifiers; Nutria no necesita ese
    // historial para aplicar el límite y evita enviar metadatos personales.
    analytics: false,
    prefix: `nutria:ratelimit:${maxRequests}:${windowMs}`,
    timeout: 1_500,
  });
  distributedLimiters.set(configKey, limiter);
  return limiter;
}

/**
 * Rate limit compartido entre instancias de Vercel mediante Upstash.
 *
 * En desarrollo sin Redis conserva un límite local. El check de lanzamiento
 * impide promover producción sin las credenciales distribuidas.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<LimitResult> {
  const pseudonymousKey = pseudonymizeRateLimitKey(key);
  if (!hasUpstashConfig()) {
    if (process.env.NODE_ENV === 'production' && !allowsLocalRateLimitInE2E()) {
      logger.error('Rate limit distribuido no configurado');
      return {
        permitido: false,
        reintentarEnSegundos: 60,
        distribuido: false,
      };
    }
    return localRateLimit(pseudonymousKey, maxRequests, windowMs);
  }

  try {
    const result = await distributedLimiter(maxRequests, windowMs).limit(pseudonymousKey);
    return {
      permitido: result.success,
      reintentarEnSegundos: result.success
        ? 0
        : Math.max(Math.ceil((result.reset - Date.now()) / 1000), 1),
      distribuido: true,
    };
  } catch (error: unknown) {
    logger.error('Falló el rate limit distribuido', error);
    if (process.env.NODE_ENV === 'production') {
      return {
        permitido: false,
        reintentarEnSegundos: 15,
        distribuido: false,
      };
    }
    return localRateLimit(pseudonymousKey, maxRequests, windowMs);
  }
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDe(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'desconocida'
  );
}
