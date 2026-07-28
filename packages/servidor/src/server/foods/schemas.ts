import { z } from 'zod';

import { GRUPOS_ALIMENTO } from '@nutria/shared';

/**
 * Validación de `/api/v1/foods`. Campos en snake_case según
 * `rules/api-conventions.md`. Nada llega a Prisma sin pasar por aquí.
 */

const GRUPOS = GRUPOS_ALIMENTO as [string, ...string[]];

/** Rangos por porción: atajan la errata de dedo, no juzgan el alimento. */
const GRAMOS = z.number().positive().max(2000);
const KCAL = z.number().min(0).max(2000);
const MACRO_G = z.number().min(0).max(500);
const MILIGRAMOS = z.number().min(0).max(20000);
const MICROGRAMOS = z.number().min(0).max(100000);

const nutrimentoOpcional = (esquema: z.ZodNumber) => esquema.nullish();

export const alimentoPropioSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del alimento.').max(120),
  grupo: z.enum(GRUPOS),
  subgrupo: z.string().trim().max(60).nullish(),
  porcion_descripcion: z
    .string()
    .trim()
    .min(1, 'Describe la porción, por ejemplo "1 taza".')
    .max(60),
  porcion_gramos: GRAMOS,
  energia_kcal: KCAL,
  proteina_g: MACRO_G,
  lipidos_g: MACRO_G,
  carbohidratos_g: MACRO_G,
  saturadas_g: nutrimentoOpcional(MACRO_G),
  colesterol_mg: nutrimentoOpcional(MILIGRAMOS),
  fibra_g: nutrimentoOpcional(MACRO_G),
  azucar_g: nutrimentoOpcional(MACRO_G),
  sodio_mg: nutrimentoOpcional(MILIGRAMOS),
  potasio_mg: nutrimentoOpcional(MILIGRAMOS),
  calcio_mg: nutrimentoOpcional(MILIGRAMOS),
  hierro_mg: nutrimentoOpcional(MILIGRAMOS),
  acido_folico_ug: nutrimentoOpcional(MICROGRAMOS),
  vitamina_a_ug: nutrimentoOpcional(MICROGRAMOS),
  vitamina_c_mg: nutrimentoOpcional(MILIGRAMOS),
  indice_glicemico: z.number().int().min(0).max(120).nullish(),
  /**
   * Opcional: si no se declaran, el servidor los deriva de la energía y el
   * grupo (`equivalentesSugeridos`). El nutriólogo siempre puede sobrescribirlos.
   */
  // `partialRecord` y no `record`: en Zod 4 un `record` con claves de enum las
  // exige todas, y un alimento declara los dos o tres grupos que aporta.
  equivalentes: z.partialRecord(z.enum(GRUPOS), z.number().min(0).max(20)).optional(),
  imagen_url: z.string().url().max(500).nullish(),
});

export const actualizarAlimentoSchema = alimentoPropioSchema.partial();

export type AlimentoPropioInput = z.infer<typeof alimentoPropioSchema>;
export type ActualizarAlimentoInput = z.infer<typeof actualizarAlimentoSchema>;

/** Filtros del listado. Van en la query string, así que todo llega como texto. */
export const busquedaSchema = z.object({
  query: z.string().trim().max(80).optional(),
  grupo: z.enum(GRUPOS).optional(),
  solo_propios: z.boolean(),
});

export type BusquedaInput = z.infer<typeof busquedaSchema>;

export function leerFiltros(searchParams: URLSearchParams) {
  return busquedaSchema.safeParse({
    query: searchParams.get('query') ?? undefined,
    grupo: searchParams.get('grupo') ?? undefined,
    solo_propios: searchParams.get('solo_propios') === 'true',
  });
}
