import { type GrupoSmae, GRUPOS_SMAE } from '../nutricion/equivalentes';

/**
 * Grupos con los que se clasifica un alimento de la base.
 *
 * Son los ocho grupos de equivalentes (`nutricion/equivalentes.ts`) más
 * `libres`: el SMAE reconoce alimentos de aporte energético despreciable
 * (café, té, condimentos, verduras libres) que no suman a ningún equivalente
 * pero sí aparecen en un plan.
 */
export type GrupoAlimento = GrupoSmae | 'libres';

export const GRUPOS_ALIMENTO: GrupoAlimento[] = [...GRUPOS_SMAE, 'libres'];

/** Etiqueta para la UI. El grupo se guarda por su clave, nunca por su nombre. */
export const NOMBRE_GRUPO_ALIMENTO: Record<GrupoAlimento, string> = {
  verduras: 'Verduras',
  frutas: 'Frutas',
  cereales: 'Cereales y tubérculos',
  leguminosas: 'Leguminosas',
  origen_animal: 'Origen animal',
  leche: 'Leche',
  aceites: 'Aceites y grasas',
  azucares: 'Azúcares',
  libres: 'Libres de energía',
};

export function esGrupoAlimento(valor: unknown): valor is GrupoAlimento {
  return typeof valor === 'string' && (GRUPOS_ALIMENTO as string[]).includes(valor);
}

/** Origen del dato nutrimental. Se muestra en la ficha para poder auditarlo. */
export type FuenteAlimento = 'incmnsz' | 'usda' | 'off' | 'propia';

export const NOMBRE_FUENTE: Record<FuenteAlimento, string> = {
  incmnsz: 'Composición de alimentos mexicanos',
  usda: 'USDA FoodData Central',
  off: 'Open Food Facts',
  propia: 'Capturado por el nutriólogo',
};
