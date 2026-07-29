import { z } from 'zod';

import type { EsquemaJson } from './cliente';

/**
 * Entradas y salidas de los tres endpoints de IA del paciente (§8 del plan).
 *
 * Igual que en el resto de `/api/v1/me/*`, ninguna entrada acepta `patient_id`:
 * lo resuelve `requierePaciente` desde la sesión. Y ninguna acepta un prompt
 * completo — el servidor lo arma — para que la seudonimización y las
 * instrucciones de seguridad no dependan de que el cliente las aplique.
 */

/* --- Entradas -------------------------------------------------------------- */

/**
 * El historial lo manda el cliente porque el coach no guarda estado en el
 * servidor: no hay tabla de conversación y no la habrá en V1 —lo que el paciente
 * le pregunta al modelo no es expediente clínico y no tiene por qué persistirse—.
 * Se acota a los últimos turnos para que un cliente manipulado no pueda inflar
 * el prompt, y todo el texto se seudonimiza antes de salir.
 */
export const MAX_TURNOS_HISTORIAL = 6;

const turnoSchema = z.object({
  rol: z.enum(['paciente', 'coach']),
  texto: z.string().trim().min(1).max(800),
});

export const coachSchema = z.object({
  mensaje: z
    .string()
    .trim()
    .min(1, 'Escribe tu pregunta.')
    .max(1_000, 'La pregunta es demasiado larga.'),
  historial: z.array(turnoSchema).max(MAX_TURNOS_HISTORIAL).optional(),
});

export const estimacionComidaSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(3, 'Describe qué comiste.')
    .max(500, 'La descripción es demasiado larga.'),
});

export const sustitucionSchema = z.object({
  ingrediente: z
    .string()
    .trim()
    .min(2, 'Indica qué ingrediente quieres cambiar.')
    .max(120, 'El nombre del ingrediente es demasiado largo.'),
  /** Receta de contexto; se valida que sea del paciente y esté enviada. */
  receta_id: z.uuid('El identificador de la receta no es válido.').optional(),
});

export type CoachInput = z.infer<typeof coachSchema>;
export type EstimacionComidaInput = z.infer<typeof estimacionComidaSchema>;
export type SustitucionInput = z.infer<typeof sustitucionSchema>;
export type TurnoCoach = z.infer<typeof turnoSchema>;

/* --- Salidas estructuradas ------------------------------------------------- */

/**
 * Los topes son los mismos que acepta `POST /me/meal_logs`: la estimación se
 * devuelve para que la app la registre ahí, y una cifra que pasara aquí para
 * reventar al guardar sería peor que rechazarla a tiempo.
 */
export const estimacionComidaBorradorSchema = z.object({
  alimento: z.string().trim().min(1).max(200),
  calorias: z.number().int().min(0).max(10_000),
  proteina_g: z.number().min(0).max(1_000),
  carbos_g: z.number().min(0).max(1_000),
  grasa_g: z.number().min(0).max(1_000),
});

export const sustitucionBorradorSchema = z.object({
  sustituto: z.string().trim().min(1).max(200),
  razon: z.string().trim().min(1).max(500),
});

export type EstimacionComidaBorrador = z.infer<typeof estimacionComidaBorradorSchema>;
export type SustitucionBorrador = z.infer<typeof sustitucionBorradorSchema>;

/* --- JSON Schemas para `output_config.format` ------------------------------ */

/**
 * Escritos a mano, no derivados de Zod: la salida estructurada de la API ignora
 * `minimum`, `maxLength` y `pattern`, y una conversión automática los colaría
 * dando una falsa sensación de garantía. Zod sigue siendo quien valida al recibir.
 */

export const ESTIMACION_COMIDA_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    alimento: {
      type: 'string',
      description: 'Qué comió, normalizado y con la cantidad. Ej. "2 tacos de pollo".',
    },
    calorias: { type: 'integer', description: 'Energía total estimada, en kcal.' },
    proteina_g: { type: 'number', description: 'Proteína total estimada, en gramos.' },
    carbos_g: { type: 'number', description: 'Carbohidratos totales estimados, en gramos.' },
    grasa_g: { type: 'number', description: 'Grasa total estimada, en gramos.' },
  },
  required: ['alimento', 'calorias', 'proteina_g', 'carbos_g', 'grasa_g'],
  additionalProperties: false,
};

export const SUSTITUCION_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    sustituto: {
      type: 'string',
      description: 'Ingrediente que reemplaza al original, con la cantidad equivalente.',
    },
    razon: {
      type: 'string',
      description: 'Por qué funciona el cambio, en una o dos frases dirigidas al paciente.',
    },
  },
  required: ['sustituto', 'razon'],
  additionalProperties: false,
};
