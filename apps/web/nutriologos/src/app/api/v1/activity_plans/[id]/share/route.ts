import { requiereNutriologo } from '@/server/auth/guards';
import { internalError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { compartirPlanActividad } from '@/server/tracking/repository';
import { serializarPlanActividad } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/activity_plans/{id}/share
 *
 * Marca `compartido_at`: es el momento en que el nutriólogo aprueba el plan y
 * queda disponible para el paciente. Un plan generado con IA y no compartido
 * sigue siendo un borrador interno.
 */
export async function POST(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plan = await compartirPlanActividad(sesion.userId, id);
    if (!plan) return notFound('No se encontró el plan de actividad.');
    return jsonOk(serializarPlanActividad(plan));
  } catch (error: unknown) {
    logger.error('Falló el compartir del plan de actividad', error);
    return internalError();
  }
}
