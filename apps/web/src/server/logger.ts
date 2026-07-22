/* eslint-disable no-console */

/**
 * Punto único de logging del servidor. En la fase 8 aquí se conecta Sentry.
 *
 * Regla del proyecto: nunca se loggean datos de salud (peso, medidas, notas
 * clínicas, mensajes). Solo pasa por aquí información operativa: identificadores,
 * códigos de error y nombres de operación.
 */
export const logger = {
  info(mensaje: string, contexto?: Record<string, unknown>): void {
    console.info(`[nutria] ${mensaje}`, contexto ?? '');
  },
  warn(mensaje: string, contexto?: Record<string, unknown>): void {
    console.warn(`[nutria] ${mensaje}`, contexto ?? '');
  },
  error(mensaje: string, error?: unknown): void {
    console.error(`[nutria] ${mensaje}`, error instanceof Error ? error.message : error);
  },
};

export function esDesarrollo(): boolean {
  return process.env.NODE_ENV !== 'production';
}
