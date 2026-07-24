import { requiereNutriologo } from '@/server/auth/guards';
import { getEntitlements } from '@/server/billing/entitlements';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  parsePagination,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import {
  AlimentoDePlanNoEncontradoError,
  crearPlantilla,
  listarPlantillas,
} from '@/server/plans/repository';
import { crearPlantillaSchema } from '@/server/plans/schemas';
import { serializarPlantilla } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/plan_templates — plantillas propias, paginadas. */
export async function GET(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const { page, perPage, skip, take } = parsePagination(searchParams);
  try {
    const { plantillas, total } = await listarPlantillas(sesion.userId, {
      skip,
      take,
    });
    return jsonList(plantillas.map(serializarPlantilla), {
      page,
      per_page: perPage,
      total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de plantillas de plan', error);
    return internalError();
  }
}

/** POST /api/v1/plan_templates — crea una plantilla reutilizable. */
export async function POST(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(
      400,
      ErrorCode.INVALID_BODY,
      'El cuerpo de la petición no es JSON válido.',
    );
  }

  const parsed = crearPlantillaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    // Mismo criterio que el alta de pacientes: el cupo se aplica en el servidor.
    const entitlements = await getEntitlements(sesion.userId);
    if (entitlements.plantillas.alcanzado) {
      return jsonError(
        402,
        ErrorCode.PLAN_LIMIT,
        `Tu plan ${entitlements.plan} incluye ${entitlements.plantillas.limite} plantillas guardadas. Mejora tu plan o borra una plantilla para crear otra.`,
      );
    }

    const plantilla = await crearPlantilla(sesion.userId, parsed.data);
    return jsonCreated(serializarPlantilla(plantilla));
  } catch (error: unknown) {
    if (error instanceof AlimentoDePlanNoEncontradoError) {
      return jsonError(
        404,
        ErrorCode.NOT_FOUND,
        'No se encontró uno de los alimentos de la plantilla.',
      );
    }
    logger.error('Falló la creación de la plantilla de plan', error);
    return internalError();
  }
}
