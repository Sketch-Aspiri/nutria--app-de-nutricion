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
import { listarComidas, registrarComida } from '@/server/tracking/repository';
import { filtroSeguimientoSchema, registrarComidaSchema } from '@/server/tracking/schemas';
import { serializarComida } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/meal_logs — comidas que registró el paciente. */
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

  const { page, perPage, skip, take } = parsePagination(searchParams);
  try {
    const resultado = await listarComidas(sesion.userId, id, { skip, take }, filtros.data);
    if (!resultado) return notFound('No se encontró el paciente.');

    return jsonList(
      resultado.comidas.map((comida) => serializarComida(comida, resultado.zonaHoraria)),
      { page, per_page: perPage, total: resultado.total },
    );
  } catch (error: unknown) {
    logger.error('Falló el listado de comidas registradas', error);
    return internalError();
  }
}

/**
 * POST /api/v1/patients/{id}/meal_logs
 *
 * Lo usará la app móvil del paciente; en el panel sirve para capturar lo que
 * el paciente reporta en consulta.
 */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarComidaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const resultado = await registrarComida(sesion.userId, id, parsed.data);
    if (!resultado) return notFound('No se encontró el paciente o la comida del plan.');
    return jsonCreated(serializarComida(resultado.comida, resultado.zonaHoraria));
  } catch (error: unknown) {
    logger.error('Falló el registro de la comida', error);
    return internalError();
  }
}
