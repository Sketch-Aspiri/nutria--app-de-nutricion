import { requiereNutriologo } from '@/server/auth/guards';
import { getEntitlements } from '@/server/billing/entitlements';
import { serializarSuscripcion } from '@/server/billing/serializers';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';

/**
 * `GET /api/v1/billing/subscription` — plan vigente, entitlements y catálogo.
 *
 * Un solo endpoint para las tres cosas porque la página de suscripción, el
 * badge del encabezado y el aviso de cupo las necesitan juntas: separarlas
 * serían tres peticiones para pintar una misma tarjeta.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const entitlements = await getEntitlements(sesion.userId);
    return jsonOk(serializarSuscripcion(entitlements));
  } catch (error: unknown) {
    logger.error('No se pudo consultar la suscripción', error);
    return internalError();
  }
}
