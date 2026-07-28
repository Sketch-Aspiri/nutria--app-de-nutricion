import { requiereNutriologo } from '@/server/auth/guards';
import { recordAuditEvent } from '@/server/audit';
import { signConsultationNote } from '@/server/consultations/repository';
import { serializeConsultationNote } from '@/server/consultations/serializers';
import { internalError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string; noteId: string }> };

/** POST /api/v1/patients/{id}/consultation_notes/{noteId}/sign */
export async function POST(request: Request, { params }: Context) {
  const session = await requiereNutriologo();
  if (!session.ok) return session.respuesta;

  const { id, noteId } = await params;
  try {
    const note = await signConsultationNote(session.userId, id, noteId);
    if (!note) return notFound('No se encontró la nota clínica.');
    await recordAuditEvent({
      userId: session.userId,
      action: 'CONSULTATION_NOTE_SIGNED',
      resource: 'consultation_note',
      resourceId: noteId,
      request,
      metadata: { patient_id: id },
    });
    return jsonOk(serializeConsultationNote(note));
  } catch (error: unknown) {
    logger.error('Falló la firma de la nota clínica', error);
    return internalError();
  }
}
