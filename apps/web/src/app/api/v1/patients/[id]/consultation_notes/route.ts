import { requiereNutriologo } from '@/server/auth/guards';
import { recordAuditEvent } from '@/server/audit';
import {
  createConsultationNote,
  listConsultationNotes,
} from '@/server/consultations/repository';
import { createConsultationNoteSchema } from '@/server/consultations/schemas';
import { serializeConsultationNote } from '@/server/consultations/serializers';
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

type Context = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/consultation_notes */
export async function GET(request: Request, { params }: Context) {
  const session = await requiereNutriologo();
  if (!session.ok) return session.respuesta;

  const { id } = await params;
  const { page, perPage, skip, take } = parsePagination(
    new URL(request.url).searchParams,
  );

  try {
    const result = await listConsultationNotes(session.userId, id, {
      skip,
      take,
    });
    if (!result) return notFound('No se encontró el paciente.');
    await recordAuditEvent({
      userId: session.userId,
      action: 'CONSULTATION_NOTES_READ',
      resource: 'patient',
      resourceId: id,
      request,
    });
    return jsonList(result.notes.map(serializeConsultationNote), {
      page,
      per_page: perPage,
      total: result.total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de notas clínicas', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/consultation_notes */
export async function POST(request: Request, { params }: Context) {
  const session = await requiereNutriologo();
  if (!session.ok) return session.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(
      400,
      ErrorCode.INVALID_BODY,
      'El cuerpo de la petición no es JSON válido.',
    );
  }

  const parsed = createConsultationNoteSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { id } = await params;
  try {
    const note = await createConsultationNote(
      session.userId,
      id,
      parsed.data,
    );
    if (!note) return notFound('No se encontró el paciente.');
    await recordAuditEvent({
      userId: session.userId,
      action: note.firmadaAt
        ? 'CONSULTATION_NOTE_CREATED_AND_SIGNED'
        : 'CONSULTATION_NOTE_CREATED',
      resource: 'consultation_note',
      resourceId: note.id,
      request,
      metadata: { patient_id: id, origin: note.origen },
    });
    return jsonCreated(serializeConsultationNote(note));
  } catch (error: unknown) {
    logger.error('Falló la creación de la nota clínica', error);
    return internalError();
  }
}
