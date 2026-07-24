import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { guardarPlanActividad, planActividadVigente } from '@/server/tracking/repository';
import { guardarPlanActividadSchema } from '@/server/tracking/schemas';
import { serializarPlanActividad } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/activity_plan — la versión vigente, o `null`. */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const plan = await planActividadVigente(sesion.userId, id);
    // `undefined` = paciente ajeno o inexistente; `null` = aún no tiene plan.
    if (plan === undefined) return notFound('No se encontró el paciente.');
    return jsonOk(plan ? serializarPlanActividad(plan) : null);
  } catch (error: unknown) {
    logger.error('Falló la consulta del plan de actividad', error);
    return internalError();
  }
}

/**
 * POST /api/v1/patients/{id}/activity_plan — guarda una versión nueva.
 *
 * No sobrescribe la anterior: si ya se compartió, es lo que el paciente tiene
 * a la vista y el expediente debe conservarlo.
 */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = guardarPlanActividadSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const plan = await guardarPlanActividad(sesion.userId, id, parsed.data);
    if (!plan) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarPlanActividad(plan));
  } catch (error: unknown) {
    logger.error('Falló el guardado del plan de actividad', error);
    return internalError();
  }
}
