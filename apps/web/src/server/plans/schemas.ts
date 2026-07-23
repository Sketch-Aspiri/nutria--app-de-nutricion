import { z } from 'zod';

import {
  MAX_COMIDAS_PLAN,
  MAX_ITEMS_POR_COMIDA,
} from '@/domain/planLimits';

/**
 * Validación de planes y plantillas. El contrato HTTP usa snake_case y los
 * enums conservan los valores de Prisma, igual que el resto de `/api/v1`.
 */

export const ESTADOS_PLAN = ['BORRADOR', 'ACTIVO', 'ARCHIVADO'] as const;
export const ORIGENES_PLAN = ['MANUAL', 'IA', 'PLANTILLA'] as const;
export const OBJETIVOS_PLANTILLA = [
  'PERDIDA_DE_GRASA',
  'GANANCIA_MUSCULAR',
  'MANTENIMIENTO',
  'CONTROL_DE_DIABETES',
  'MEJORA_DEPORTIVA',
  'OTRO',
] as const;

const idSchema = z.string().uuid('El identificador no es válido.');
const caloriasPlanSchema = z.number().int().min(0).max(20_000);
const macroPlanSchema = z.number().int().min(0).max(5_000);
const nutrimentoItemSchema = z.number().min(0).max(20_000);

const foodResumenSchema = z.object({
  id: idSchema,
  nombre: z.string(),
  grupo: z.string(),
  porcion_descripcion: z.string(),
  porcion_gramos: z.number(),
  imagen_url: z.string().nullable(),
});

const itemBaseSchema = z.object({
  id: idSchema.optional(),
  food_id: idSchema.nullish(),
  /** Snapshot descriptivo para poder editar una plantilla sin otra consulta. */
  food: foodResumenSchema.nullish(),
  descripcion_libre: z.string().trim().min(1).max(300).nullish(),
  cantidad_porciones: z.number().positive().max(50).default(1),
  /**
   * En items ligados a un alimento estos valores se ignoran: el servidor
   * siempre toma el alimento vigente y guarda un snapshot escalado.
   */
  energia_kcal: nutrimentoItemSchema.optional(),
  proteina_g: nutrimentoItemSchema.optional(),
  carbohidratos_g: nutrimentoItemSchema.optional(),
  lipidos_g: nutrimentoItemSchema.optional(),
});

export const itemPlanSchema = itemBaseSchema.superRefine((item, contexto) => {
  if (item.food_id) return;

  if (!item.descripcion_libre) {
    contexto.addIssue({
      code: 'custom',
      path: ['descripcion_libre'],
      message: 'Describe el alimento cuando no eliges uno de la base.',
    });
  }

  const nutrimentos = [
    'energia_kcal',
    'proteina_g',
    'carbohidratos_g',
    'lipidos_g',
  ] as const;
  for (const nutrimento of nutrimentos) {
    if (item[nutrimento] === undefined) {
      contexto.addIssue({
        code: 'custom',
        path: [nutrimento],
        message: 'Captura los nutrimentos del item libre.',
      });
    }
  }
});

export const comidaPlanSchema = z.object({
  id: idSchema.optional(),
  orden: z.number().int().min(0).max(50).optional(),
  nombre: z.string().trim().min(1, 'Escribe el nombre de la comida.').max(80),
  horario: z.string().trim().max(30).nullish(),
  descripcion: z.string().trim().max(500).nullish(),
  items: z.array(itemPlanSchema).max(MAX_ITEMS_POR_COMIDA).default([]),
});

export const estructuraPlantillaSchema = z.object({
  comidas: z.array(comidaPlanSchema).max(MAX_COMIDAS_PLAN).default([]),
});

const camposPlanSchema = z.object({
  calorias_diarias: caloriasPlanSchema,
  proteina_g: macroPlanSchema,
  carbos_g: macroPlanSchema,
  grasa_g: macroPlanSchema,
  nota: z.string().trim().max(2_000).nullish(),
  origen: z.enum(ORIGENES_PLAN),
  estado: z.enum(ESTADOS_PLAN),
});

export const crearPlanSchema = camposPlanSchema
  .partial()
  .extend({
    plantilla_id: idSchema.optional(),
    comidas: z.array(comidaPlanSchema).max(MAX_COMIDAS_PLAN).optional(),
  })
  .superRefine((plan, contexto) => {
    if (plan.plantilla_id) return;

    const requeridos = [
      'calorias_diarias',
      'proteina_g',
      'carbos_g',
      'grasa_g',
    ] as const;
    for (const campo of requeridos) {
      if (plan[campo] === undefined) {
        contexto.addIssue({
          code: 'custom',
          path: [campo],
          message: 'Este campo es obligatorio al crear un plan manual.',
        });
      }
    }
  });

export const actualizarPlanSchema = camposPlanSchema
  .partial()
  .extend({
    expected_updated_at: z.iso.datetime(),
    comidas: z.array(comidaPlanSchema).max(MAX_COMIDAS_PLAN).optional(),
  })
  .refine((plan) => Object.keys(plan).some((campo) => campo !== 'expected_updated_at'), {
    message: 'Envía al menos un campo para actualizar además de la versión.',
  });

export const filtroPlanesSchema = z.object({
  estado: z.enum(ESTADOS_PLAN).optional(),
});

const camposPlantillaSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la plantilla.').max(120),
  objetivo: z.enum(OBJETIVOS_PLANTILLA),
  calorias: caloriasPlanSchema,
  descripcion: z.string().trim().max(1_000).nullish(),
  estructura: estructuraPlantillaSchema,
});

export const crearPlantillaSchema = camposPlantillaSchema;
export const actualizarPlantillaSchema = camposPlantillaSchema
  .partial()
  .refine((plantilla) => Object.keys(plantilla).length > 0, {
    message: 'Envía al menos un campo para actualizar.',
  });

export type ItemPlanInput = z.infer<typeof itemPlanSchema>;
export type ComidaPlanInput = z.infer<typeof comidaPlanSchema>;
export type CrearPlanInput = z.infer<typeof crearPlanSchema>;
export type ActualizarPlanInput = z.infer<typeof actualizarPlanSchema>;
export type FiltroPlanesInput = z.infer<typeof filtroPlanesSchema>;
export type CrearPlantillaInput = z.infer<typeof crearPlantillaSchema>;
export type ActualizarPlantillaInput = z.infer<typeof actualizarPlantillaSchema>;
