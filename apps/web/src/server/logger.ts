/* eslint-disable no-console */

import * as Sentry from '@sentry/nextjs';

/**
 * Punto único de logging del servidor. En la fase 8 aquí se conecta Sentry.
 *
 * Regla del proyecto: nunca se loggean datos de salud (peso, medidas, notas
 * clínicas, mensajes). Solo pasa por aquí información operativa: identificadores,
 * códigos de error y nombres de operación.
 */
export const logger = {
  info(mensaje: string, contexto?: Record<string, unknown>): void {
    console.info(`[nutria] ${mensaje}`, contextoSeguro(contexto));
  },
  warn(mensaje: string, contexto?: Record<string, unknown>): void {
    console.warn(`[nutria] ${mensaje}`, contextoSeguro(contexto));
  },
  error(mensaje: string, error?: unknown): void {
    const safeError = errorSeguro(error);
    console.error(`[nutria] ${mensaje}`, safeError);
    Sentry.captureException(new Error(mensaje), {
      tags: {
        error_code:
          typeof safeError === 'object' && 'codigo' in safeError
            ? safeError.codigo
            : 'UNEXPECTED',
      },
    });
  },
};

const CLAVES_CONTEXTO_PERMITIDAS = new Set([
  'code',
  'correlationId',
  'operation',
  'provider',
  'status',
]);

function contextoSeguro(
  contexto?: Record<string, unknown>,
): Record<string, string | number> | '' {
  if (!contexto) return '';

  return Object.fromEntries(
    Object.entries(contexto).flatMap(([clave, valor]) =>
      CLAVES_CONTEXTO_PERMITIDAS.has(clave) &&
      (typeof valor === 'string' || typeof valor === 'number')
        ? [[clave, limpiarControl(valor)]]
        : [],
    ),
  );
}

function errorSeguro(error: unknown): Record<string, string> | '' {
  if (!error) return '';

  const tipo =
    error instanceof Error && /^[A-Za-z0-9_.-]{1,80}$/.test(error.name)
      ? error.name
      : 'UnknownError';
  const codigo =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_-]{1,32}$/i.test(error.code)
      ? error.code
      : null;

  return codigo ? { tipo, codigo } : { tipo };
}

function limpiarControl(valor: string | number): string | number {
  return typeof valor === 'string'
    ? valor.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120)
    : valor;
}

export function esDesarrollo(): boolean {
  return process.env.NODE_ENV !== 'production';
}
