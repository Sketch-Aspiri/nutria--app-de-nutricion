import type { ConsultationNote } from '@prisma/client';

export function serializeConsultationNote(note: ConsultationNote) {
  return {
    id: note.id,
    patient_id: note.patientId,
    fecha: note.fecha.toISOString(),
    motivo: note.motivo,
    hallazgos: note.hallazgos,
    plan: note.plan,
    seguimiento: note.seguimiento,
    origen: note.origen,
    firmada_at: note.firmadaAt?.toISOString() ?? null,
    created_at: note.createdAt.toISOString(),
  };
}
