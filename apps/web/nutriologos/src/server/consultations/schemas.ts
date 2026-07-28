import { z } from 'zod';

const clinicalField = z.string().trim().min(1).max(8_000);

export const createConsultationNoteSchema = z.object({
  motivo: clinicalField,
  hallazgos: clinicalField,
  plan: clinicalField,
  seguimiento: clinicalField,
  origen: z.enum(['MANUAL', 'IA']).default('MANUAL'),
  firmar: z.boolean().default(false),
});

export type CreateConsultationNoteInput = z.infer<
  typeof createConsultationNoteSchema
>;
