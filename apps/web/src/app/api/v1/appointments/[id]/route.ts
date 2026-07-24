import { requiereNutriologo } from '@/server/auth/guards';
import {
  actualizarCita,
  CitaEmpalmadaError,
  eliminarCita,
  obtenerCita,
} from '@/server/appointments/repository';
import { actualizarCitaSchema } from '@/server/appointments/schemas';
import { serializarCita } from '@/server/appointments/serializers';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonNoContent,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/appointments/{id} */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const cita = await obtenerCita(sesion.userId, id);
    if (!cita) return notFound('No se encontró la cita.');
    return jsonOk(serializarCita(cita));
  } catch (error: unknown) {
    logger.error('Falló la consulta de la cita', error);
    return internalError();
  }
}

/** PATCH /api/v1/appointments/{id} — reprograma o cambia los datos de la cita. */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = actualizarCitaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const cita = await actualizarCita(sesion.userId, id, parsed.data);
    if (!cita) return notFound('No se encontró la cita.');
    return jsonOk(serializarCita(cita));
  } catch (error: unknown) {
    if (error instanceof CitaEmpalmadaError) {
      return jsonError(
        409,
        ErrorCode.APPOINTMENT_CONFLICT,
        'Ya tienes otra consulta en ese horario.',
      );
    }
    logger.error('Falló la actualización de la cita', error);
    return internalError();
  }
}

/** DELETE /api/v1/appointments/{id} — borra la cita de la agenda. */
export async function DELETE(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const borrada = await eliminarCita(sesion.userId, id);
    if (!borrada) return notFound('No se encontró la cita.');
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló el borrado de la cita', error);
    return internalError();
  }
}
