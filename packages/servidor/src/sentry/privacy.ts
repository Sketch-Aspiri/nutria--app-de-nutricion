import type { Event, EventHint } from '@sentry/nextjs';

const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const LONG_NUMBER = /\b\d{7,}\b/g;
const ALLOWED_HEADERS = new Set([
  'content-type',
  'user-agent',
  'x-vercel-id',
  'x-request-id',
]);
const ALLOWED_TAGS = new Set([
  'environment',
  'error_code',
  'operation',
  'provider',
  'runtime',
]);

export function scrubString(value: string): string {
  return value
    .replace(UUID, '[id]')
    .replace(EMAIL, '[email]')
    .replace(LONG_NUMBER, '[number]')
    .slice(0, 300);
}

function scrubUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, 'https://redacted.invalid');
    const path = scrubString(url.pathname);
    return url.origin === 'https://redacted.invalid'
      ? path
      : `${url.origin}${path}`;
  } catch {
    return scrubString(raw.split('?')[0] ?? raw);
  }
}

/**
 * Elimina datos personales y clínicos antes de abandonar el proceso.
 *
 * Se conservan stack frames, tipo de excepción, ruta sin ids y metadatos
 * operativos allowlisted. Nunca salen bodies, query strings, cookies, auth,
 * breadcrumbs de consola, `extra` ni información de usuario.
 */
export function safeBeforeSend<T extends Event>(event: T, _hint: EventHint): T {
  event.user = undefined;
  event.extra = undefined;
  event.contexts = undefined;
  event.spans = undefined;

  if (event.request) {
    const headers = Object.fromEntries(
      Object.entries(event.request.headers ?? {}).flatMap(([key, value]) =>
        ALLOWED_HEADERS.has(key.toLowerCase()) && typeof value === 'string'
          ? [[key.toLowerCase(), scrubString(value)]]
          : [],
      ),
    );
    event.request = {
      method: event.request.method,
      url: scrubUrl(event.request.url),
      headers,
    };
  }

  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
  }));

  event.tags = Object.fromEntries(
    Object.entries(event.tags ?? {}).flatMap(([key, value]) =>
      ALLOWED_TAGS.has(key) &&
      (typeof value === 'string' || typeof value === 'number')
        ? [[key, scrubString(String(value))]]
        : [],
    ),
  );

  event.message = event.message ? scrubString(event.message) : undefined;
  event.transaction = event.transaction
    ? scrubString(event.transaction)
    : undefined;
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.type || 'Error',
      stacktrace: exception.stacktrace
        ? {
            frames: exception.stacktrace.frames?.map((frame) => ({
              filename: frame.filename ? scrubString(frame.filename) : undefined,
              function: frame.function,
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app,
            })),
          }
        : undefined,
    }));
  }

  return event;
}

export function sentryEnvironment(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

export function tracesSampleRate(): number {
  // Las transacciones y spans no atraviesan `beforeSend`. Hasta incorporar
  // una allowlist específica para tracing, se capturan solo excepciones.
  return 0;
}
