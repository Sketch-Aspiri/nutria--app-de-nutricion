import { z } from 'zod';

import { passwordSchema } from '@/server/auth/password';

/**
 * Entradas de `/api/v1/me/*`.
 *
 * Ninguna acepta `patient_id`: la guarda `requierePaciente` lo resuelve en el
 * servidor a partir de la sesión (§6.2 del plan). Un campo así en el body sería
 * una invitación a confiar en el cliente.
 */

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const fechaSchema = z
  .string()
  .regex(FECHA_ISO, 'La fecha debe tener el formato AAAA-MM-DD.');

export const filtroFechasSchema = z.object({
  desde: fechaSchema.optional(),
  hasta: fechaSchema.optional(),
});

/**
 * Un registro de comida es una de dos cosas: marcar una comida del plan
 * (`meal_plan_meal_id`) o anotar una libre. Las dos comparten tabla, así que
 * los macros son opcionales y solo la libre suele traerlos.
 */
export const registrarComidaSchema = z.object({
  meal_plan_meal_id: z.uuid('El identificador de la comida del plan no es válido.').optional(),
  nombre: z.string().trim().min(1, 'Escribe qué comiste.').max(200),
  fecha: z.iso.datetime({ message: 'La fecha debe ser un instante ISO 8601.' }).optional(),
  calorias: z.number().int().min(0).max(10_000).optional(),
  proteina_g: z.number().min(0).max(1_000).optional(),
  carbos_g: z.number().min(0).max(1_000).optional(),
  grasa_g: z.number().min(0).max(1_000).optional(),
  foto_url: z.url('La foto debe ser una URL válida.').max(500).optional(),
  comentario_paciente: z.string().trim().max(1_000).optional(),
  /** `IA` cuando los macros vienen de la estimación del coach (fase 5). */
  origen: z.enum(['MANUAL', 'IA']).default('MANUAL'),
});

export const registrarPesoSchema = z.object({
  fecha: fechaSchema,
  peso_kg: z
    .number()
    .min(20, 'El peso debe ser mayor a 20 kg.')
    .max(400, 'El peso debe ser menor a 400 kg.'),
});

export const registrarEjercicioSchema = z.object({
  fecha: fechaSchema,
  tipo: z.string().trim().min(1, 'Indica qué ejercicio hiciste.').max(100),
  duracion_min: z
    .number()
    .int()
    .min(1, 'La duración debe ser de al menos un minuto.')
    .max(1_440, 'La duración no puede exceder un día.'),
});

export const guardarAguaSchema = z.object({
  fecha: fechaSchema,
  vasos: z
    .number()
    .int()
    .min(0, 'Los vasos no pueden ser negativos.')
    .max(30, 'Registra un número de vasos realista.'),
});

export const enviarMensajeSchema = z.object({
  texto: z.string().trim().min(1, 'Escribe un mensaje.').max(2_000),
});

/**
 * Cambio de contraseña del paciente.
 *
 * `actual` no lleva reglas de longitud a propósito: es lo que el paciente ya
 * tiene, y validarla contra la política de hoy rechazaría contraseñas viejas
 * legítimas antes siquiera de comprobarlas. La política se aplica a `nueva`.
 */
export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, 'Escribe tu contraseña actual.').max(200),
  nueva: passwordSchema,
});

/**
 * Baja de la cuenta.
 *
 * Exige la contraseña: es la última acción irreversible de la app, y un
 * teléfono desbloqueado sobre una mesa no debería bastar para ejecutarla.
 */
export const darDeBajaSchema = z.object({
  password: z.string().min(1, 'Escribe tu contraseña para confirmar.').max(200),
  confirmacion: z.literal(true, {
    message: 'Necesitas confirmar que entiendes qué pasa al darte de baja.',
  }),
});

export type FiltroFechasInput = z.infer<typeof filtroFechasSchema>;
export type RegistrarComidaInput = z.infer<typeof registrarComidaSchema>;
export type RegistrarPesoInput = z.infer<typeof registrarPesoSchema>;
export type RegistrarEjercicioInput = z.infer<typeof registrarEjercicioSchema>;
export type GuardarAguaInput = z.infer<typeof guardarAguaSchema>;
export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
export type DarDeBajaInput = z.infer<typeof darDeBajaSchema>;
