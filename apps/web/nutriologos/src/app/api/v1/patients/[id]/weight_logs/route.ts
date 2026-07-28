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
import { listarPesos, registrarPeso } from '@/server/tracking/repository';
import { filtroSeguimientoSchema, registrarPesoSchema } from '@/server/tracking/schemas';
import { serializarPeso } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/weight_logs — histórico de peso, en orden cronológico. */
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
    const registros = await listarPesos(sesion.userId, id, filtros.data);
    if (!registros) return notFound('No se encontró el paciente.');

    return jsonList(registros.map(serializarPeso), {
      page: 1,
      per_page: registros.length,
      total: registros.length,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de registros de peso', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/weight_logs — un peso por día; repetirlo corrige. */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarPesoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const registro = await registrarPeso(sesion.userId, id, parsed.data);
    if (!registro) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarPeso(registro));
  } catch (error: unknown) {
    logger.error('Falló el registro de peso', error);
    return internalError();
  }
}
