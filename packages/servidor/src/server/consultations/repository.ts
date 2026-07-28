import type { ConsultationNote } from '@prisma/client';

import {
  decryptText,
  encryptText,
  ENCRYPTION_CONTEXT,
} from '@/server/crypto';
import { prisma } from '@/server/db';
import { pacientePropio } from '@/server/patients/ownership';

import type { CreateConsultationNoteInput } from './schemas';

function decryptNote(note: ConsultationNote): ConsultationNote {
  return {
    ...note,
    motivo:
      decryptText(note.motivo, ENCRYPTION_CONTEXT.consultationMotivo) ?? null,
    hallazgos:
      decryptText(note.hallazgos, ENCRYPTION_CONTEXT.consultationHallazgos) ??
      null,
    plan: decryptText(note.plan, ENCRYPTION_CONTEXT.consultationPlan) ?? null,
    seguimiento:
      decryptText(
        note.seguimiento,
        ENCRYPTION_CONTEXT.consultationSeguimiento,
      ) ?? null,
  };
}

export async function listConsultationNotes(
  nutritionistId: string,
  patientId: string,
  pagination: { skip: number; take: number },
): Promise<{ notes: ConsultationNote[]; total: number } | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const where = { patientId };
  const [notes, total] = await Promise.all([
    prisma.consultationNote.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.consultationNote.count({ where }),
  ]);

  return { notes: notes.map(decryptNote), total };
}

export async function createConsultationNote(
  nutritionistId: string,
  patientId: string,
  input: CreateConsultationNoteInput,
): Promise<ConsultationNote | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const note = await prisma.consultationNote.create({
    data: {
      patientId,
      fecha: new Date(),
      motivo: encryptText(
        input.motivo,
        ENCRYPTION_CONTEXT.consultationMotivo,
      ),
      hallazgos: encryptText(
        input.hallazgos,
        ENCRYPTION_CONTEXT.consultationHallazgos,
      ),
      plan: encryptText(input.plan, ENCRYPTION_CONTEXT.consultationPlan),
      seguimiento: encryptText(
        input.seguimiento,
        ENCRYPTION_CONTEXT.consultationSeguimiento,
      ),
      origen: input.origen,
      firmadaAt: input.firmar ? new Date() : null,
    },
  });

  return decryptNote(note);
}

/**
 * Firma una nota propia una sola vez. No existe endpoint de edición ni borrado:
 * las correcciones clínicas se agregan como una nota nueva.
 */
export async function signConsultationNote(
  nutritionistId: string,
  patientId: string,
  noteId: string,
): Promise<ConsultationNote | null> {
  if (!(await pacientePropio(nutritionistId, patientId))) return null;

  const note = await prisma.consultationNote.findFirst({
    where: { id: noteId, patientId },
  });
  if (!note) return null;
  if (note.firmadaAt) return decryptNote(note);

  const signed = await prisma.consultationNote.update({
    where: { id: noteId },
    data: { firmadaAt: new Date() },
  });
  return decryptNote(signed);
}
