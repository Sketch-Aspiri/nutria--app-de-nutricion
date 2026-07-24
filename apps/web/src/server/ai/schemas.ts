import { z } from 'zod';

import { MAX_COMIDAS_PLAN, MAX_ITEMS_POR_COMIDA } from '@/domain/planLimits';

import type { EsquemaJson } from './cliente';

/**
 * Contrato de `POST /api/v1/ai/generate` y forma de las salidas estructuradas.
 *
 * El cuerpo es una unión discriminada por `tipo`: cada caso de uso pide lo que
 * necesita y nada más. La UI ya no manda prompts — los arma el servidor — para
 * que la seudonimización y las instrucciones de seguridad no dependan de que
 * el cliente se acuerde de aplicarlas.
 */

const idSchema = z.string().uuid('El identificador no es válido.');
const notasSchema = z.string().trim().max(1_000).optional();

const baseSchema = z.object({
  /** SSE hacia la UI; el contrato de datos es el mismo en ambos modos. */
  stream: z.boolean().optional().default(false),
});

export const generarPlanSchema = baseSchema.extend({
  tipo: z.literal('PLAN'),
  patient_id: idSchema,
  /** Enfoque libre del nutriólogo: "desayunos rápidos", "más fibra"… */
  notas: notasSchema,
});

export const generarNotaClinicaSchema = baseSchema.extend({
  tipo: z.literal('NOTA_CLINICA'),
  patient_id: idSchema,
  texto: z
    .string()
    .trim()
    .min(20, 'Escribe o dicta la nota antes de estructurarla.')
    .max(12_000, 'La nota excede el tamaño permitido.'),
});

export const generarRecetaSchema = baseSchema.extend({
  tipo: z.literal('RECETA'),
  patient_id: idSchema,
  /** Idea de partida o receta a ajustar. */
  idea: notasSchema,
  /** Meta energética por porción; si falta, se usa la del plan del paciente. */
  calorias_objetivo: z.number().int().min(50).max(3_000).optional(),
});

export const generarRespuestaMensajeSchema = baseSchema.extend({
  tipo: z.literal('RESPUESTA_MENSAJE'),
  patient_id: idSchema,
  mensaje: z
    .string()
    .trim()
    .min(1, 'No hay mensaje al cual responder.')
    .max(4_000, 'El mensaje excede el tamaño permitido.'),
  /** Intención del nutriólogo para la respuesta. */
  intencion: notasSchema,
});

export const generarPlanActividadSchema = baseSchema.extend({
  tipo: z.literal('PLAN_ACTIVIDAD'),
  patient_id: idSchema,
  notas: notasSchema,
});

export const generarSchema = z.discriminatedUnion('tipo', [
  generarPlanSchema,
  generarNotaClinicaSchema,
  generarRecetaSchema,
  generarRespuestaMensajeSchema,
  generarPlanActividadSchema,
]);

export type GenerarInput = z.infer<typeof generarSchema>;
export type GenerarPlanInput = z.infer<typeof generarPlanSchema>;
export type GenerarNotaClinicaInput = z.infer<typeof generarNotaClinicaSchema>;
export type GenerarRecetaInput = z.infer<typeof generarRecetaSchema>;
export type GenerarRespuestaMensajeInput = z.infer<typeof generarRespuestaMensajeSchema>;
export type GenerarPlanActividadInput = z.infer<typeof generarPlanActividadSchema>;

/* -------------------------------------------------------------------------- */
/* Salidas estructuradas                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Un item del borrador: o referencia un alimento del catálogo que se le ofreció
 * al modelo (`food_id`), o lo describe en texto con sus nutrimentos. El servidor
 * verifica después que el `food_id` exista de verdad; el modelo no puede crear
 * alimentos nuevos en la base.
 */
export const itemBorradorSchema = z.object({
  food_id: z.string().nullable(),
  descripcion: z.string().trim().min(1).max(300),
  cantidad_porciones: z.number().positive().max(50),
});

export const comidaBorradorSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  horario: z.string().trim().max(30),
  descripcion: z.string().trim().max(500),
  items: z.array(itemBorradorSchema).min(1).max(MAX_ITEMS_POR_COMIDA),
});

export const planBorradorSchema = z.object({
  calorias_diarias: z.number().int().min(600).max(6_000),
  proteina_g: z.number().int().min(0).max(500),
  carbos_g: z.number().int().min(0).max(1_000),
  grasa_g: z.number().int().min(0).max(400),
  comidas: z.array(comidaBorradorSchema).min(1).max(MAX_COMIDAS_PLAN),
  nota: z.string().trim().max(1_000),
});

export type PlanBorrador = z.infer<typeof planBorradorSchema>;

export const notaClinicaBorradorSchema = z.object({
  motivo: z.string().trim().min(1).max(1_000),
  hallazgos: z.string().trim().min(1).max(4_000),
  plan: z.string().trim().min(1).max(4_000),
  seguimiento: z.string().trim().min(1).max(2_000),
});

export type NotaClinicaBorrador = z.infer<typeof notaClinicaBorradorSchema>;

export const recetaBorradorSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  ingredientes: z.array(z.string().trim().min(1).max(200)).min(1).max(30),
  pasos: z.string().trim().min(1).max(4_000),
  calorias: z.number().int().min(0).max(3_000),
  porciones: z.number().int().min(1).max(20),
});

export type RecetaBorrador = z.infer<typeof recetaBorradorSchema>;

/* -------------------------------------------------------------------------- */
/* JSON Schemas para `output_config.format`                                    */
/* -------------------------------------------------------------------------- */

/**
 * Los schemas que viajan a la API se escriben a mano en vez de derivarse de Zod:
 * la salida estructurada no admite `minimum`, `maxLength` ni `pattern`, y una
 * conversión automática los colaría. Zod sigue siendo quien valida al recibir.
 */

const ITEM_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    food_id: {
      type: ['string', 'null'],
      description: 'Identificador exacto de un alimento del catálogo, o null si lo describes libremente.',
    },
    descripcion: { type: 'string', description: 'Alimento y cantidad, en lenguaje natural.' },
    cantidad_porciones: {
      type: 'number',
      description: 'Cuántas porciones del alimento del catálogo, respecto a su porción de referencia.',
    },
  },
  required: ['food_id', 'descripcion', 'cantidad_porciones'],
  additionalProperties: false,
};

export const PLAN_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    calorias_diarias: { type: 'integer', description: 'Energía total del día, en kcal.' },
    proteina_g: { type: 'integer' },
    carbos_g: { type: 'integer' },
    grasa_g: { type: 'integer' },
    comidas: {
      type: 'array',
      description: 'Tiempos de comida del día, en orden cronológico.',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Ej. Desayuno, Colación matutina, Comida.' },
          horario: { type: 'string', description: 'Hora sugerida, ej. 08:00.' },
          descripcion: { type: 'string', description: 'Indicación breve para el paciente.' },
          items: { type: 'array', items: ITEM_JSON_SCHEMA },
        },
        required: ['nombre', 'horario', 'descripcion', 'items'],
        additionalProperties: false,
      },
    },
    nota: {
      type: 'string',
      description: 'Qué debe revisar el nutriólogo antes de aprobar este borrador.',
    },
  },
  required: ['calorias_diarias', 'proteina_g', 'carbos_g', 'grasa_g', 'comidas', 'nota'],
  additionalProperties: false,
};

export const NOTA_CLINICA_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    motivo: { type: 'string', description: 'Motivo de la consulta.' },
    hallazgos: { type: 'string', description: 'Hallazgos referidos y observados.' },
    plan: { type: 'string', description: 'Plan acordado en la consulta.' },
    seguimiento: { type: 'string', description: 'Qué revisar en la siguiente cita.' },
  },
  required: ['motivo', 'hallazgos', 'plan', 'seguimiento'],
  additionalProperties: false,
};

export const RECETA_JSON_SCHEMA: EsquemaJson = {
  type: 'object',
  properties: {
    nombre: { type: 'string' },
    ingredientes: { type: 'array', items: { type: 'string' } },
    pasos: { type: 'string', description: 'Preparación en pasos numerados.' },
    calorias: { type: 'integer', description: 'Energía por porción, en kcal.' },
    porciones: { type: 'integer' },
  },
  required: ['nombre', 'ingredientes', 'pasos', 'calorias', 'porciones'],
  additionalProperties: false,
};
