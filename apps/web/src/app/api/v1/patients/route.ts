import { requiereNutriologo } from '@/server/auth/guards';
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
import { crearPaciente, listarPacientes } from '@/server/patients/repository';
import { crearPacienteSchema } from '@/server/patients/schemas';
import {
  serializarPacienteDetalle,
  serializarPacienteResumen,
} from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/patients — listado paginado del nutriólogo autenticado. */
export async function GET(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const { page, perPage, skip, take } = parsePagination(searchParams);

  try {
    const { pacientes, total } = await listarPacientes(sesion.userId, {
      skip,
      take,
      busqueda: searchParams.get('query')?.trim() || undefined,
      incluirArchivados: searchParams.get('incluir_archivados') === 'true',
    });

    return jsonList(pacientes.map(serializarPacienteResumen), {
      page,
      per_page: perPage,
      total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de pacientes', error);
    return internalError();
  }
}

/** POST /api/v1/patients — alta completa desde el asistente de 4 pasos. */
export async function POST(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = crearPacienteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    // El tope de pacientes del plan Free se aplica en la fase 7, junto con la
    // ruta de upgrade: imponerlo antes dejaría al nutriólogo sin salida.
    const paciente = await crearPaciente(sesion.userId, parsed.data);
    return jsonCreated(serializarPacienteDetalle(paciente));
  } catch (error: unknown) {
    logger.error('Falló el alta de paciente', error);
    return internalError();
  }
}
