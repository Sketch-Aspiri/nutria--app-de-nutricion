import { z } from 'zod';

import { esFechaIso } from '@nutria/shared';

/**
 * Validación del seguimiento: comidas, peso y ejercicio registrados por el
 * paciente, más el plan de actividad que le propone el nutriólogo.
 */

/** Día civil `YYYY-MM-DD`, sin hora: es la unidad con la que se mide adherencia. */
const fechaCivilSchema = z
  .string()
  .refine(esFechaIso, 'La fecha debe tener el formato YYYY-MM-DD.');

const instanteSchema = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'La fecha y hora no son válidas.')
  .transform((valor) => new Date(valor));

const idSchema = z.string().uuid('El identificador no es válido.');

// Rangos clínicamente plausibles: por encima o por debajo es un error de
// captura, y aceptarlo contaminaría la gráfica de peso del expediente.
const PESO_MIN_KG = 20;
const PESO_MAX_KG = 400;

export const registrarComidaSchema = z.object({
  fecha: instanteSchema,
  nombre: z.string().trim().min(1, 'La comida necesita un nombre.').max(200),
  foto_url: z.string().trim().url().nullish(),
  comentario_paciente: z.string().trim().max(1_000).nullish(),
  meal_plan_meal_id: idSchema.nullish(),
});

/** Lo único que el nutriólogo escribe sobre una comida ya registrada. */
export const comentarComidaSchema = z.object({
  comentario_nutriologo: z.string().trim().max(1_000).nullable(),
});

export const registrarPesoSchema = z.object({
  fecha: fechaCivilSchema,
  peso_kg: z.number().min(PESO_MIN_KG).max(PESO_MAX_KG),
});

export const registrarEjercicioSchema = z.object({
  fecha: fechaCivilSchema,
  tipo: z.string().trim().min(1, 'Indica qué actividad fue.').max(120),
  duracion_min: z.number().int().min(1).max(1_440),
});

export const filtroSeguimientoSchema = z.object({
  desde: fechaCivilSchema.optional(),
  hasta: fechaCivilSchema.optional(),
});

export const consultaAdherenciaSchema = z.object({
  dias: z.coerce.number().int().min(1).max(90).default(7),
});

export const guardarPlanActividadSchema = z.object({
  texto: z.string().trim().min(1, 'El plan de actividad no puede ir vacío.').max(5_000),
  origen: z.enum(['MANUAL', 'IA']).default('MANUAL'),
});

export type RegistrarComidaInput = z.infer<typeof registrarComidaSchema>;
export type ComentarComidaInput = z.infer<typeof comentarComidaSchema>;
export type RegistrarPesoInput = z.infer<typeof registrarPesoSchema>;
export type RegistrarEjercicioInput = z.infer<typeof registrarEjercicioSchema>;
export type FiltroSeguimientoInput = z.infer<typeof filtroSeguimientoSchema>;
export type ConsultaAdherenciaInput = z.infer<typeof consultaAdherenciaSchema>;
export type GuardarPlanActividadInput = z.infer<typeof guardarPlanActividadSchema>;
