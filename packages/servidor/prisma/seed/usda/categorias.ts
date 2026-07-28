import type { GrupoAlimento } from '@nutria/shared';

/**
 * Categoría de USDA FoodData Central → grupo de equivalentes.
 *
 * USDA clasifica por origen del alimento; el SMAE, por aporte nutrimental.
 * Las categorías que no aparecen aquí (comida rápida, platillos preparados,
 * fórmulas infantiles, bebidas alcohólicas) se descartan: no encajan en un
 * grupo de equivalentes sin decidir por el nutriólogo.
 */
export const GRUPO_POR_CATEGORIA_USDA: Record<string, GrupoAlimento> = {
  'Vegetables and Vegetable Products': 'verduras',
  'Fruits and Fruit Juices': 'frutas',
  'Cereal Grains and Pasta': 'cereales',
  'Baked Products': 'cereales',
  'Breakfast Cereals': 'cereales',
  'Legumes and Legume Products': 'leguminosas',
  'Poultry Products': 'origen_animal',
  'Beef Products': 'origen_animal',
  'Pork Products': 'origen_animal',
  'Lamb, Veal, and Game Products': 'origen_animal',
  'Finfish and Shellfish Products': 'origen_animal',
  'Sausages and Luncheon Meats': 'origen_animal',
  'Dairy and Egg Products': 'origen_animal',
  'Fats and Oils': 'aceites',
  'Nut and Seed Products': 'aceites',
  'Sweets': 'azucares',
  'Spices and Herbs': 'libres',
  Beverages: 'libres',
};

/**
 * La categoría de USDA no distingue leche de queso: ambos son "Dairy and Egg".
 * Estas palabras en la descripción mandan sobre la categoría.
 */
const PALABRAS_LECHE = ['milk', 'yogurt', 'buttermilk', 'kefir'];
const PALABRAS_ACEITES = ['cream', 'butter', 'oil'];

export function grupoDeUsda(categoria: string, descripcion: string): GrupoAlimento | null {
  const grupo = GRUPO_POR_CATEGORIA_USDA[categoria];
  if (!grupo) return null;

  if (grupo === 'origen_animal') {
    const texto = descripcion.toLowerCase();
    if (PALABRAS_LECHE.some((palabra) => texto.includes(palabra))) return 'leche';
    if (PALABRAS_ACEITES.some((palabra) => texto.includes(palabra))) return 'aceites';
  }

  return grupo;
}
