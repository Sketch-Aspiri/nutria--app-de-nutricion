import { z } from 'zod';

/**
 * Validación de la agenda. El contrato HTTP usa snake_case y los enums
 * conservan los valores de Prisma, igual que el resto de `/api/v1`.
 */

export const TIPOS_CITA = ['PRESENCIAL', 'VIDEOLLAMADA'] as const;
export const ESTADOS_CITA = ['PROGRAMADA', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO'] as const;

/** Consultas de una hora y media como techo; más allá es un error de captura. */
export const DURACION_MIN_CITA = 5;
export const DURACION_MAX_CITA = 480;

const idSchema = z.string().uuid('El identificador no es válido.');

/**
 * Instante en ISO 8601 con zona (`rules/api-conventions.md`). Se exige el
 * desplazamiento: "2026-08-01T09:00" sin zona lo interpretaría el servidor en
 * UTC y la cita aparecería seis horas corrida en el consultorio.
 */
const instanteSchema = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), 'La fecha y hora no son válidas.')
  .refine(
    (valor) => /(?:Z|[+-]\d{2}:?\d{2})$/.test(valor.trim()),
    'La fecha debe incluir la zona horaria (por ejemplo, 2026-08-01T09:00:00-06:00).',
  )
  .transform((valor) => new Date(valor));

/**
 * El enlace de la sala se pega a mano y termina en un `href` del correo del
 * paciente. `z.url()` aceptaría `javascript:` y `data:`, así que el protocolo
 * se restringe explícitamente.
 */
const videoUrlSchema = z
  .string()
  .trim()
  .url('El enlace de la videollamada no es válido.')
  .refine((valor) => {
    try {
      return new URL(valor).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'El enlace de la videollamada debe empezar con https://');

export const crearCitaSchema = z.object({
  patient_id: idSchema,
  inicio: instanteSchema,
  duracion_min: z.number().int().min(DURACION_MIN_CITA).max(DURACION_MAX_CITA).default(45),
  tipo: z.enum(TIPOS_CITA).default('PRESENCIAL'),
  notas: z.string().trim().max(1_000).nullish(),
  video_url: videoUrlSchema.nullish(),
});

export const actualizarCitaSchema = z
  .object({
    inicio: instanteSchema.optional(),
    duracion_min: z.number().int().min(DURACION_MIN_CITA).max(DURACION_MAX_CITA).optional(),
    tipo: z.enum(TIPOS_CITA).optional(),
    estado: z.enum(ESTADOS_CITA).optional(),
    notas: z.string().trim().max(1_000).nullish(),
    video_url: videoUrlSchema.nullish(),
  })
  .refine((datos) => Object.keys(datos).length > 0, 'No hay cambios que guardar.');

export const filtroCitasSchema = z.object({
  estado: z.enum(ESTADOS_CITA).optional(),
  patient_id: idSchema.optional(),
  /** Rango de la vista semanal; ambos extremos son opcionales. */
  desde: instanteSchema.optional(),
  hasta: instanteSchema.optional(),
});

export type CrearCitaInput = z.infer<typeof crearCitaSchema>;
export type ActualizarCitaInput = z.infer<typeof actualizarCitaSchema>;
export type FiltroCitasInput = z.infer<typeof filtroCitasSchema>;
