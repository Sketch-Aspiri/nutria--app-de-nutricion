import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonNoContent,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  actualizarPlan,
  AlergenoEnPlanError,
  AlimentoDePlanNoEncontradoError,
  archivarPlan,
  buscarPlan,
  DesviacionEnergeticaPlanError,
  EstructuraPlanInvalidaError,
  PlanIncompletoError,
  PlanNoEditableError,
  VersionPlanObsoletaError,
} from '@/server/plans/repository';
import { actualizarPlanSchema } from '@/server/plans/schemas';
import { serializarPlan } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };
const NO_ENCONTRADO = 'No se encontró el plan alimenticio.';

/** GET /api/v1/meal_plans/{id} — plan completo con comidas e items. */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plan = await buscarPlan(sesion.userId, id);
    if (!plan) return notFound(NO_ENCONTRADO);
    return jsonOk(serializarPlan(plan));
  } catch (error: unknown) {
    logger.error('Falló la lectura del plan alimenticio', error);
    return internalError();
  }
}

/**
 * PATCH /api/v1/meal_plans/{id} — edición parcial. Si incluye `comidas`, la
 * colección se reemplaza completa dentro de la transacción.
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(
      400,
      ErrorCode.INVALID_BODY,
      'El cuerpo de la petición no es JSON válido.',
    );
  }

  const parsed = actualizarPlanSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const plan = await actualizarPlan(sesion.userId, id, parsed.data);
    if (!plan) return notFound(NO_ENCONTRADO);
    return jsonOk(serializarPlan(plan));
  } catch (error: unknown) {
    if (error instanceof AlimentoDePlanNoEncontradoError) {
      return notFound('No se encontró uno de los alimentos del plan.');
    }
    if (error instanceof PlanNoEditableError) {
      return jsonError(
        409,
        ErrorCode.PLAN_NOT_EDITABLE,
        'Los planes activos o archivados son históricos. Crea un borrador para modificarlos.',
      );
    }
    if (error instanceof VersionPlanObsoletaError) {
      return jsonError(
        409,
        ErrorCode.PLAN_VERSION_CONFLICT,
        'Otra sesión guardó cambios en este plan. Recarga antes de volver a editar.',
      );
    }
    if (error instanceof EstructuraPlanInvalidaError) {
      return jsonError(
        422,
        ErrorCode.PLAN_STRUCTURE_INVALID,
        'La estructura contiene comidas o items que no pertenecen a este plan.',
      );
    }
    if (error instanceof PlanIncompletoError) {
      return jsonError(
        422,
        ErrorCode.PLAN_INCOMPLETE,
        'Agrega calorías, una comida y al menos un alimento antes de activar el plan.',
      );
    }
    if (error instanceof DesviacionEnergeticaPlanError) {
      return jsonError(
        422,
        ErrorCode.PLAN_ENERGY_OUT_OF_RANGE,
        'Ajusta la energía calculada para quedar dentro de ±5% de la meta antes de activar el plan.',
      );
    }
    if (error instanceof AlergenoEnPlanError) {
      return jsonError(
        422,
        ErrorCode.PLAN_ALLERGEN_CONFLICT,
        'El plan menciona un alérgeno registrado para el paciente.',
      );
    }
    logger.error('Falló la edición del plan alimenticio', error);
    return internalError();
  }
}

/** DELETE /api/v1/meal_plans/{id} — archiva sin borrar el historial clínico. */
export async function DELETE(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const archivado = await archivarPlan(sesion.userId, id);
    if (!archivado) return notFound(NO_ENCONTRADO);
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló el archivado del plan alimenticio', error);
    return internalError();
  }
}
