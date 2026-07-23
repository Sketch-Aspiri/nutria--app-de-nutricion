import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { actualizarExpedienteMedico, buscarPaciente } from '@/server/patients/repository';
import { expedienteMedicoSchema } from '@/server/patients/schemas';
import { serializarExpedienteMedico } from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/medical_record */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const paciente = await buscarPaciente(sesion.userId, id);
    if (!paciente) return notFound('No se encontró el paciente.');
    return jsonOk(serializarExpedienteMedico(paciente.medicalRecord));
  } catch (error: unknown) {
    logger.error('Falló la lectura del expediente médico', error);
    return internalError();
  }
}

/** PATCH /api/v1/patients/{id}/medical_record */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = expedienteMedicoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const expediente = await actualizarExpedienteMedico(sesion.userId, id, parsed.data);
    if (!expediente) return notFound('No se encontró el paciente.');
    return jsonOk(serializarExpedienteMedico(expediente));
  } catch (error: unknown) {
    logger.error('Falló la actualización del expediente médico', error);
    return internalError();
  }
}
