import { requiereNutriologo } from '@/server/auth/guards';
import { internalError, jsonCreated, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { duplicarPlan } from '@/server/plans/repository';
import { serializarPlan } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** POST /api/v1/meal_plans/{id}/duplicate — copia editable en estado borrador. */
export async function POST(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plan = await duplicarPlan(sesion.userId, id);
    if (!plan) return notFound('No se encontró el plan alimenticio.');
    return jsonCreated(serializarPlan(plan));
  } catch (error: unknown) {
    logger.error('Falló la duplicación del plan alimenticio', error);
    return internalError();
  }
}
