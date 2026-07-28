import type { AlimentoCatalogo } from './contexto';
import type { PlanBorrador } from './schemas';

/**
 * Traduce el borrador de la IA a la misma estructura que ya usa el editor de
 * planes, resolviendo cada `food_id` contra el catálogo real.
 *
 * Los nutrimentos los pone el servidor a partir de la fila del alimento, nunca
 * el modelo: la IA elige *qué* y *cuánto*, la aritmética la hace la base. Así un
 * borrador aceptado no puede traer kcal inventadas.
 */

export type ItemBorradorEnriquecido = {
  food_id: string | null;
  descripcion_libre: string | null;
  cantidad_porciones: number;
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
  food: {
    id: string;
    nombre: string;
    grupo: string;
    porcion_descripcion: string;
    porcion_gramos: number;
    imagen_url: string | null;
  } | null;
};

export type ComidaBorradorEnriquecida = {
  orden: number;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: ItemBorradorEnriquecido[];
};

export type PlanBorradorEnriquecido = {
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  nota: string;
  comidas: ComidaBorradorEnriquecida[];
  /** Totales recalculados desde los alimentos, para contrastarlos con la meta. */
  totales: {
    energia_kcal: number;
    proteina_g: number;
    carbohidratos_g: number;
    lipidos_g: number;
  };
};

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function limpio(valor: string): string | null {
  const texto = valor.trim();
  return texto ? texto : null;
}

export function enriquecerPlanBorrador(
  plan: PlanBorrador,
  alimentos: AlimentoCatalogo[],
): PlanBorradorEnriquecido {
  const porId = new Map(alimentos.map((alimento) => [alimento.id, alimento]));

  const comidas = plan.comidas.map((comida, orden) => ({
    orden,
    nombre: comida.nombre,
    horario: limpio(comida.horario),
    descripcion: limpio(comida.descripcion),
    items: comida.items.map((item): ItemBorradorEnriquecido => {
      const alimento = item.food_id ? porId.get(item.food_id) : undefined;
      const cantidad = item.cantidad_porciones;

      // Sin alimento del catálogo el item queda libre y en ceros: el editor lo
      // muestra para que el nutriólogo capture o sustituya, en vez de heredar
      // cifras que nadie calculó.
      if (!alimento) {
        return {
          food_id: null,
          descripcion_libre: item.descripcion,
          cantidad_porciones: cantidad,
          energia_kcal: 0,
          proteina_g: 0,
          carbohidratos_g: 0,
          lipidos_g: 0,
          food: null,
        };
      }

      return {
        food_id: alimento.id,
        descripcion_libre: null,
        cantidad_porciones: cantidad,
        energia_kcal: redondear(alimento.energiaKcal * cantidad),
        proteina_g: redondear(alimento.proteinaG * cantidad),
        carbohidratos_g: redondear(alimento.carbosG * cantidad),
        lipidos_g: redondear(alimento.lipidosG * cantidad),
        food: {
          id: alimento.id,
          nombre: alimento.nombre,
          grupo: alimento.grupo,
          porcion_descripcion: alimento.porcionDescripcion,
          porcion_gramos: alimento.porcionGramos,
          imagen_url: alimento.imagenUrl,
        },
      };
    }),
  }));

  const items = comidas.flatMap((comida) => comida.items);
  const sumar = (extraer: (item: ItemBorradorEnriquecido) => number): number =>
    redondear(items.reduce((total, item) => total + extraer(item), 0));

  return {
    calorias_diarias: plan.calorias_diarias,
    proteina_g: plan.proteina_g,
    carbos_g: plan.carbos_g,
    grasa_g: plan.grasa_g,
    nota: plan.nota,
    comidas,
    totales: {
      energia_kcal: sumar((item) => item.energia_kcal),
      proteina_g: sumar((item) => item.proteina_g),
      carbohidratos_g: sumar((item) => item.carbohidratos_g),
      lipidos_g: sumar((item) => item.lipidos_g),
    },
  };
}
