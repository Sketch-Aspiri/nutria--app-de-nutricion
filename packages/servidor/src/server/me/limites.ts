import { ErrorCode, jsonError } from '@/server/http';
import { rateLimit } from '@/server/rate-limit';

/**
 * Límites de tasa de la app del paciente (§7 del plan).
 *
 * Se cuentan por `user_id`, no por IP: todos los endpoints exigen sesión, y una
 * red móvil compartida (o un CGNAT) pondría a decenas de pacientes detrás de la
 * misma dirección.
 */

export const ESCRITURAS_POR_MINUTO = 60;
export const FOTOS_POR_HORA = 20;
/**
 * La IA tiene además un tope mensual por paciente (§8.5), que es el que acota el
 * gasto. Este límite por minuto resuelve otra cosa: que un cliente en bucle
 * queme las 30 interacciones del mes en diez segundos.
 */
export const INTERACCIONES_IA_POR_MINUTO = 6;

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

type Limite = { permitido: true } | { permitido: false; respuesta: ReturnType<typeof jsonError> };

const EXCEDIDO = 'Estás enviando demasiadas peticiones. Espera un momento.';

/** Toda escritura de `/api/v1/me/*` pasa por aquí antes de tocar la base. */
export async function limiteDeEscritura(userId: string): Promise<Limite> {
  const resultado = await rateLimit(`me:write:${userId}`, ESCRITURAS_POR_MINUTO, MINUTO_MS);
  if (resultado.permitido) return { permitido: true };
  return {
    permitido: false,
    respuesta: jsonError(429, ErrorCode.RATE_LIMITED, EXCEDIDO),
  };
}

/** Ráfagas de IA: el tope mensual protege el bolsillo, este protege el minuto. */
export async function limiteDeIa(userId: string): Promise<Limite> {
  const resultado = await rateLimit(`me:ai:${userId}`, INTERACCIONES_IA_POR_MINUTO, MINUTO_MS);
  if (resultado.permitido) return { permitido: true };
  return {
    permitido: false,
    respuesta: jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Espera unos segundos antes de volver a preguntarle al asistente.',
    ),
  };
}

/** Las fotos van aparte: cuestan almacenamiento y ancho de banda, no solo CPU. */
export async function limiteDeFotos(userId: string): Promise<Limite> {
  const resultado = await rateLimit(`me:photo:${userId}`, FOTOS_POR_HORA, HORA_MS);
  if (resultado.permitido) return { permitido: true };
  return {
    permitido: false,
    respuesta: jsonError(
      429,
      ErrorCode.RATE_LIMITED,
      'Subiste demasiadas fotos por ahora. Intenta más tarde.',
    ),
  };
}
