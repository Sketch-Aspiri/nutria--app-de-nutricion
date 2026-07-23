import { z } from 'zod';

/**
 * Validación de los cuerpos de `/api/v1/patients`. Campos en snake_case según
 * `rules/api-conventions.md`. Nada llega a Prisma sin pasar por aquí.
 */

const GENEROS = ['FEMENINO', 'MASCULINO', 'OTRO'] as const;
const NIVELES_ACTIVIDAD = ['SEDENTARIO', 'LIGERO', 'MODERADO', 'ACTIVO', 'MUY_ACTIVO'] as const;
const OBJETIVOS = [
  'PERDIDA_DE_GRASA',
  'GANANCIA_MUSCULAR',
  'MANTENIMIENTO',
  'CONTROL_DE_DIABETES',
  'MEJORA_DEPORTIVA',
  'OTRO',
] as const;
const PRESUPUESTOS_TIEMPO = ['Bajo', 'Medio', 'Alto'] as const;

/** Rangos plausibles en consulta: atajan errores de dedo, no diagnostican. */
const PESO_KG = z.number().positive().max(500);
const ALTURA_CM = z.number().positive().max(260);
const PERIMETRO_CM = z.number().positive().max(300);
const PORCENTAJE = z.number().min(0).max(100);

const fechaIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
  .refine((valor) => !Number.isNaN(new Date(valor).getTime()), 'La fecha no existe.');

export const medicionSchema = z.object({
  fecha: fechaIso.optional(),
  peso_kg: PESO_KG.nullish(),
  altura_cm: ALTURA_CM.nullish(),
  cintura_cm: PERIMETRO_CM.nullish(),
  cadera_cm: PERIMETRO_CM.nullish(),
  grasa_pct: PORCENTAJE.nullish(),
  musculo_pct: PORCENTAJE.nullish(),
  pliegues: z
    .object({
      tricipital: z.number().min(0).max(100).optional(),
      bicipital: z.number().min(0).max(100).optional(),
      subescapular: z.number().min(0).max(100).optional(),
      suprailiaco: z.number().min(0).max(100).optional(),
    })
    .nullish(),
});

export const expedienteMedicoSchema = z.object({
  condiciones: z.array(z.string().max(80)).max(20).optional(),
  antecedentes: z.string().max(4000).nullish(),
  medicamentos: z.string().max(2000).nullish(),
  nivel_actividad: z.enum(NIVELES_ACTIVIDAD).optional(),
  objetivo: z.enum(OBJETIVOS).optional(),
});

export const preferenciasSchema = z.object({
  tipo_dieta: z.string().max(60).nullish(),
  alergias: z.array(z.string().max(80)).max(30).optional(),
  disgustos: z.string().max(1000).nullish(),
  comidas_por_dia: z.number().int().min(1).max(10).optional(),
  presupuesto_tiempo: z.enum(PRESUPUESTOS_TIEMPO).optional(),
});

export const crearPacienteSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del paciente.').max(120),
  fecha_nacimiento: fechaIso.nullish(),
  genero: z.enum(GENEROS).optional(),
  email: z.union([z.email('El correo no tiene un formato válido.'), z.literal('')]).nullish(),
  telefono: z.string().max(30).nullish(),
  foto_url: z.string().max(2_000_000).nullish(),
  expediente_medico: expedienteMedicoSchema.optional(),
  preferencias_alimentarias: preferenciasSchema.optional(),
  antropometria: medicionSchema.optional(),
});

export const actualizarPacienteSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120).optional(),
    fecha_nacimiento: fechaIso.nullish(),
    genero: z.enum(GENEROS).optional(),
    email: z.union([z.email(), z.literal('')]).nullish(),
    telefono: z.string().max(30).nullish(),
    foto_url: z.string().max(2_000_000).nullish(),
    estado: z.enum(['ACTIVO', 'ARCHIVADO']).optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No hay nada que actualizar.',
  });

export type CrearPacienteInput = z.infer<typeof crearPacienteSchema>;
export type ActualizarPacienteInput = z.infer<typeof actualizarPacienteSchema>;
export type MedicionInput = z.infer<typeof medicionSchema>;
export type ExpedienteMedicoInput = z.infer<typeof expedienteMedicoSchema>;
export type PreferenciasInput = z.infer<typeof preferenciasSchema>;
