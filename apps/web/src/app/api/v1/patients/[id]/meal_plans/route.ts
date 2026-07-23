import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  notFound,
  parsePagination,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  AlergenoEnPlanError,
  AlimentoDePlanNoEncontradoError,
  crearPlan,
  DesviacionEnergeticaPlanError,
  listarPlanes,
  PlanIncompletoError,
  PlantillaDePlanNoEncontradaError,
} from '@/server/plans/repository';
import {
  crearPlanSchema,
  filtroPlanesSchema,
} from '@/server/plans/schemas';
import { serializarPlan } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/meal_plans — historial paginado del paciente. */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const filtros = filtroPlanesSchema.safeParse({
    estado: searchParams.get('estado') ?? undefined,
  });
  if (!filtros.success) return validationError(filtros.error);

  const { page, perPage, skip, take } = parsePagination(searchParams);
  try {
    const resultado = await listarPlanes(
      sesion.userId,
      id,
      { skip, take },
      filtros.data,
    );
    if (!resultado) return notFound('No se encontró el paciente.');

    return jsonList(resultado.planes.map(serializarPlan), {
      page,
      per_page: perPage,
      total: resultado.total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de planes alimenticios', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/meal_plans — crea un borrador manual o desde plantilla. */
export async function POST(request: Request, { params }: Contexto) {
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

  const parsed = crearPlanSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const plan = await crearPlan(sesion.userId, id, parsed.data);
    if (!plan) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarPlan(plan));
  } catch (error: unknown) {
    if (error instanceof AlimentoDePlanNoEncontradoError) {
      return notFound('No se encontró uno de los alimentos del plan.');
    }
    if (error instanceof PlantillaDePlanNoEncontradaError) {
      return notFound('No se encontró la plantilla.');
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
    logger.error('Falló la creación del plan alimenticio', error);
    return internalError();
  }
}
