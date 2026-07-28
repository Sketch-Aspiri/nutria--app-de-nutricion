import { requiereNutriologo } from '@/server/auth/guards';
import { recordAuditEvent } from '@/server/audit';
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
import {
  actualizarPaciente,
  archivarPaciente,
  buscarPaciente,
} from '@/server/patients/repository';
import { actualizarPacienteSchema } from '@/server/patients/schemas';
import { serializarPacienteDetalle } from '@/server/patients/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id} — expediente completo. */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const paciente = await buscarPaciente(sesion.userId, id);
    // 404 también si es de otro nutriólogo: un 403 revelaría que el id existe.
    if (!paciente) return notFound('No se encontró el paciente.');
    await recordAuditEvent({
      userId: sesion.userId,
      action: 'PATIENT_RECORD_READ',
      resource: 'patient',
      resourceId: id,
      request,
    });
    return jsonOk(serializarPacienteDetalle(paciente));
  } catch (error: unknown) {
    logger.error('Falló la lectura del paciente', error);
    return internalError();
  }
}

/** PATCH /api/v1/patients/{id} — datos generales. */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = actualizarPacienteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const paciente = await actualizarPaciente(sesion.userId, id, parsed.data);
    if (!paciente) return notFound('No se encontró el paciente.');
    return jsonOk(serializarPacienteDetalle(paciente));
  } catch (error: unknown) {
    logger.error('Falló la actualización del paciente', error);
    return internalError();
  }
}

/** DELETE /api/v1/patients/{id} — archiva; el expediente clínico se conserva. */
export async function DELETE(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const archivado = await archivarPaciente(sesion.userId, id);
    if (!archivado) return notFound('No se encontró el paciente.');
    await recordAuditEvent({
      userId: sesion.userId,
      action: 'PATIENT_PROCESSING_RESTRICTED',
      resource: 'patient',
      resourceId: id,
      request,
      metadata: { reason: 'archived_by_nutritionist' },
    });
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló el archivado del paciente', error);
    return internalError();
  }
}
