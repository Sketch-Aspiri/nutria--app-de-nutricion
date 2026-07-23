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
import { agregarMedicion, listarMediciones } from '@/server/patients/repository';
import { medicionSchema } from '@/server/patients/schemas';
import { serializarMedicion } from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/patients/{id}/measurements — histórico antropométrico completo,
 * de la medición más reciente a la más antigua. Sin paginar: alimenta la gráfica
 * de evolución y un expediente no acumula miles de mediciones.
 */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const mediciones = await listarMediciones(sesion.userId, id);
    if (!mediciones) return notFound('No se encontró el paciente.');

    const serializadas = mediciones.map(serializarMedicion);
    return jsonList(serializadas, {
      page: 1,
      per_page: serializadas.length,
      total: serializadas.length,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de mediciones', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/measurements — nueva toma de medidas. */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = medicionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const medicion = await agregarMedicion(sesion.userId, id, parsed.data);
    if (!medicion) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarMedicion(medicion));
  } catch (error: unknown) {
    logger.error('Falló el alta de medición', error);
    return internalError();
  }
}
