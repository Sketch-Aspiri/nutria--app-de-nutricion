import { requierePaciente } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { listarPesos, registrarPeso } from '@/server/me/repository';
import { filtroFechasSchema, registrarPesoSchema } from '@/server/me/schemas';
import { serializarPeso } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me/weight_logs — serie de peso, de la más antigua a la más nueva. */
export async function GET(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const parsed = filtroFechasSchema.safeParse({
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  try {
    const pesos = await listarPesos(sesion.patientId, parsed.data);
    return jsonList(pesos.map(serializarPeso), {
      page: 1,
      per_page: pesos.length,
      total: pesos.length,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de pesos del paciente', error);
    return internalError();
  }
}

/** POST /api/v1/me/weight_logs — un peso por día; volver a pesarse corrige. */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarPesoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonCreated(serializarPeso(await registrarPeso(sesion.patientId, parsed.data)));
  } catch (error: unknown) {
    logger.error('Falló el registro de peso del paciente', error);
    return internalError();
  }
}
