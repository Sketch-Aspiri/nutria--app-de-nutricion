import { requiereNutriologo } from '@/server/auth/guards';
import {
  CitaEmpalmadaError,
  crearCita,
  listarCitas,
} from '@/server/appointments/repository';
import { crearCitaSchema, filtroCitasSchema } from '@/server/appointments/schemas';
import { serializarCita } from '@/server/appointments/serializers';
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

export const dynamic = 'force-dynamic';

/** GET /api/v1/appointments — agenda del nutriólogo, filtrable por rango y estado. */
export async function GET(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const filtros = filtroCitasSchema.safeParse({
    estado: searchParams.get('estado') ?? undefined,
    patient_id: searchParams.get('patient_id') ?? undefined,
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
  });
  if (!filtros.success) return validationError(filtros.error);

  const { page, perPage, skip, take } = parsePagination(searchParams);
  try {
    const { citas, total } = await listarCitas(sesion.userId, { skip, take }, filtros.data);
    return jsonList(citas.map(serializarCita), { page, per_page: perPage, total });
  } catch (error: unknown) {
    logger.error('Falló el listado de citas', error);
    return internalError();
  }
}

/** POST /api/v1/appointments — agenda una consulta. */
export async function POST(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = crearCitaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const cita = await crearCita(sesion.userId, parsed.data);
    if (!cita) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarCita(cita));
  } catch (error: unknown) {
    if (error instanceof CitaEmpalmadaError) {
      return jsonError(
        409,
        ErrorCode.APPOINTMENT_CONFLICT,
        'Ya tienes otra consulta en ese horario.',
      );
    }
    logger.error('Falló la creación de la cita', error);
    return internalError();
  }
}
