import type { Alimento } from './types';

/** Base de alimentos y equivalencias (SMAE simplificada) para el MVP. */
export const ALIMENTOS: Alimento[] = [
  { cat: 'Cereales', nombre: 'Tortilla de maíz', porcion: '1 pza (30g)', kcal: 70, prot: 2, carb: 14, gras: 1 },
  { cat: 'Cereales', nombre: 'Arroz cocido', porcion: '1/2 taza', kcal: 80, prot: 2, carb: 17, gras: 0 },
  { cat: 'Cereales', nombre: 'Avena', porcion: '1/3 taza', kcal: 75, prot: 3, carb: 13, gras: 1 },
  { cat: 'Cereales', nombre: 'Pan integral', porcion: '1 reb', kcal: 70, prot: 3, carb: 13, gras: 1 },
  { cat: 'Leguminosas', nombre: 'Frijol cocido', porcion: '1/2 taza', kcal: 120, prot: 8, carb: 20, gras: 1 },
  { cat: 'Leguminosas', nombre: 'Lentejas', porcion: '1/2 taza', kcal: 115, prot: 9, carb: 20, gras: 0 },
  { cat: 'Proteína', nombre: 'Pechuga de pollo', porcion: '40g', kcal: 55, prot: 12, carb: 0, gras: 1 },
  { cat: 'Proteína', nombre: 'Huevo', porcion: '1 pza', kcal: 75, prot: 6, carb: 0, gras: 5 },
  { cat: 'Proteína', nombre: 'Atún en agua', porcion: '40g', kcal: 50, prot: 11, carb: 0, gras: 1 },
  { cat: 'Proteína', nombre: 'Salmón', porcion: '40g', kcal: 80, prot: 10, carb: 0, gras: 4 },
  { cat: 'Verduras', nombre: 'Nopales', porcion: '1 taza', kcal: 25, prot: 2, carb: 5, gras: 0 },
  { cat: 'Verduras', nombre: 'Espinaca', porcion: '1 taza', kcal: 20, prot: 2, carb: 3, gras: 0 },
  { cat: 'Verduras', nombre: 'Jitomate', porcion: '1 pza', kcal: 22, prot: 1, carb: 5, gras: 0 },
  { cat: 'Frutas', nombre: 'Manzana', porcion: '1 pza', kcal: 60, prot: 0, carb: 15, gras: 0 },
  { cat: 'Frutas', nombre: 'Plátano', porcion: '1/2 pza', kcal: 60, prot: 1, carb: 15, gras: 0 },
  { cat: 'Frutas', nombre: 'Fresas', porcion: '1 taza', kcal: 50, prot: 1, carb: 12, gras: 0 },
  { cat: 'Grasas', nombre: 'Aguacate', porcion: '1/3 pza', kcal: 80, prot: 1, carb: 4, gras: 7 },
  { cat: 'Grasas', nombre: 'Almendras', porcion: '10 pza', kcal: 70, prot: 3, carb: 3, gras: 6 },
  { cat: 'Lácteos', nombre: 'Yogurt griego natural', porcion: '1 taza', kcal: 100, prot: 10, carb: 8, gras: 3 },
  { cat: 'Lácteos', nombre: 'Leche descremada', porcion: '1 taza', kcal: 90, prot: 9, carb: 12, gras: 0 },
];

export const CATEGORIAS_ALIMENTO: string[] = [...new Set(ALIMENTOS.map((a) => a.cat))];

/** Filtra la base de alimentos por categoría ("Todas" no filtra) y texto de búsqueda. */
export function filtrarAlimentos(query: string, categoria: string): Alimento[] {
  const q = query.trim().toLowerCase();
  return ALIMENTOS.filter(
    (a) => (categoria === 'Todas' || a.cat === categoria) && a.nombre.toLowerCase().includes(q),
  );
}
