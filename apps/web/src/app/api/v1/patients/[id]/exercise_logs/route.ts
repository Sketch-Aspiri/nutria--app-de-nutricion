import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { listarEjercicio, registrarEjercicio } from '@/server/tracking/repository';
import { filtroSeguimientoSchema, registrarEjercicioSchema } from '@/server/tracking/schemas';
import { serializarEjercicio } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/exercise_logs */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const filtros = filtroSeguimientoSchema.safeParse({
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
  });
  if (!filtros.success) return validationError(filtros.error);

  try {
    const registros = await listarEjercicio(sesion.userId, id, filtros.data);
    if (!registros) return notFound('No se encontró el paciente.');

    return jsonList(registros.map(serializarEjercicio), {
      page: 1,
      per_page: registros.length,
      total: registros.length,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de ejercicio registrado', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/exercise_logs */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarEjercicioSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const registro = await registrarEjercicio(sesion.userId, id, parsed.data);
    if (!registro) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarEjercicio(registro));
  } catch (error: unknown) {
    logger.error('Falló el registro de ejercicio', error);
    return internalError();
  }
}
