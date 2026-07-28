import type { GrupoAlimento } from '@nutria/shared';

/**
 * Qué se le pide a USDA FoodData Central.
 *
 * No se importa el catálogo completo (más de 8,000 registros, muchos de ellos
 * platillos preparados y productos de marca estadounidense). Se piden los
 * alimentos genéricos que un nutriólogo en México receta, y se descarta lo que
 * no cae en el grupo esperado: así el import no mete carne en "verduras"
 * porque USDA clasificó distinto.
 */
export type ConsultaUsda = {
  termino: string;
  /** Grupo esperado; un resultado que mapee a otro grupo se descarta. */
  grupo: GrupoAlimento;
  /** Resultados a pedir. USDA los devuelve por relevancia. */
  maximo: number;
};

/**
 * Son pocas consultas y grandes a propósito: la llave gratuita de USDA tiene
 * un cupo por hora, y una petición de 200 resultados rinde mucho más que diez
 * de veinte. Con esta lista el import completo cabe en un solo cupo.
 */
export const CONSULTAS_USDA: ConsultaUsda[] = [
  { termino: 'vegetables raw cooked boiled', grupo: 'verduras', maximo: 200 },
  { termino: 'fruit raw dried', grupo: 'frutas', maximo: 200 },
  { termino: 'rice pasta grains bread cooked', grupo: 'cereales', maximo: 200 },
  { termino: 'potatoes sweet potato breakfast cereals', grupo: 'cereales', maximo: 100 },
  { termino: 'beans lentils chickpeas peas cooked', grupo: 'leguminosas', maximo: 100 },
  { termino: 'chicken turkey beef pork cooked', grupo: 'origen_animal', maximo: 200 },
  { termino: 'fish salmon tuna shrimp cooked', grupo: 'origen_animal', maximo: 100 },
  { termino: 'cheese egg cooked', grupo: 'origen_animal', maximo: 100 },
  { termino: 'milk yogurt', grupo: 'leche', maximo: 60 },
  { termino: 'nuts seeds oil', grupo: 'aceites', maximo: 100 },
  { termino: 'sugar honey syrup jam', grupo: 'azucares', maximo: 60 },
  { termino: 'spices herbs', grupo: 'libres', maximo: 40 },
];
