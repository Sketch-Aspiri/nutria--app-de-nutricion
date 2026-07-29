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
import { listarEjercicio, registrarEjercicio } from '@/server/me/repository';
import { filtroFechasSchema, registrarEjercicioSchema } from '@/server/me/schemas';
import { serializarEjercicio } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me/exercise_logs — ejercicio registrado, del más reciente atrás. */
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
    const registros = await listarEjercicio(sesion.patientId, parsed.data);
    return jsonList(registros.map(serializarEjercicio), {
      page: 1,
      per_page: registros.length,
      total: registros.length,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de ejercicio del paciente', error);
    return internalError();
  }
}

/** POST /api/v1/me/exercise_logs — tipo y duración. */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarEjercicioSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonCreated(serializarEjercicio(await registrarEjercicio(sesion.patientId, parsed.data)));
  } catch (error: unknown) {
    logger.error('Falló el registro de ejercicio del paciente', error);
    return internalError();
  }
}
