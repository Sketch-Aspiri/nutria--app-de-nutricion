import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  AlergenoEnPlanError,
  compartirPlan,
  DesviacionEnergeticaPlanError,
  PlanIncompletoError,
} from '@/server/plans/repository';
import { serializarPlan } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/meal_plans/{id}/share — activa y marca como compartido.
 * Repetir la petición solo actualiza la fecha y conserva un único plan activo.
 */
export async function POST(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plan = await compartirPlan(sesion.userId, id);
    if (!plan) return notFound('No se encontró el plan alimenticio.');
    return jsonOk(serializarPlan(plan));
  } catch (error: unknown) {
    if (error instanceof PlanIncompletoError) {
      return jsonError(
        422,
        ErrorCode.PLAN_INCOMPLETE,
        'Agrega calorías, una comida y al menos un alimento antes de compartir el plan.',
      );
    }
    if (error instanceof DesviacionEnergeticaPlanError) {
      return jsonError(
        422,
        ErrorCode.PLAN_ENERGY_OUT_OF_RANGE,
        'Ajusta la energía calculada para quedar dentro de ±5% de la meta antes de compartir el plan.',
      );
    }
    if (error instanceof AlergenoEnPlanError) {
      return jsonError(
        422,
        ErrorCode.PLAN_ALLERGEN_CONFLICT,
        'El plan menciona un alérgeno registrado para el paciente.',
      );
    }
    logger.error('Falló el envío del plan alimenticio', error);
    return internalError();
  }
}
