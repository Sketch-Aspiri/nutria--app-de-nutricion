import type { ComidaPlan, ItemPlan, Receta } from './types';

export type TotalesNutricionales = {
  calorias: number;
  proteina: number;
  carbos: number;
  grasa: number;
};

const VACIO: TotalesNutricionales = {
  calorias: 0,
  proteina: 0,
  carbos: 0,
  grasa: 0,
};

function numero(valor: number | null | undefined): number {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

/** Suma los snapshots del plan; no recalcula nutrientes desde el catálogo actual. */
export function totalesDeComida(comida: ComidaPlan): TotalesNutricionales {
  return comida.items.reduce<TotalesNutricionales>(
    (total, item) => ({
      calorias: total.calorias + numero(item.energia_kcal),
      proteina: total.proteina + numero(item.proteina_g),
      carbos: total.carbos + numero(item.carbohidratos_g),
      grasa: total.grasa + numero(item.lipidos_g),
    }),
    { ...VACIO },
  );
}

export function descripcionDeComida(comida: ComidaPlan): string {
  if (comida.descripcion?.trim()) return comida.descripcion;
  const alimentos = comida.items
    .map((item) => item.food?.nombre ?? item.descripcion_libre)
    .filter((nombre): nombre is string => Boolean(nombre));
  return alimentos.length > 0 ? alimentos.join(' · ') : 'Consulta los detalles en tu plan.';
}

/**
 * Renglón de un alimento del plan: "Avena — 1 taza".
 *
 * La porción es lo que el paciente necesita para servirse, y es justo el dato
 * que el prototipo mostraba como un texto fijo ("1 plato"). Aquí sale del
 * snapshot: si la nutrióloga puso media porción, dice media.
 */
export function descripcionDeItem(item: ItemPlan): string {
  const nombre = item.food?.nombre ?? item.descripcion_libre ?? 'Alimento';
  const porcion = porcionDeItem(item);
  return porcion ? `${nombre} — ${porcion}` : nombre;
}

/** Cantidad servida, si el plan la trae. `null` cuando no hay nada que decir. */
export function porcionDeItem(item: ItemPlan): string | null {
  const descripcion = item.food?.porcion_descripcion?.trim();
  const cantidad = item.cantidad_porciones;

  if (!descripcion) return null;
  if (typeof cantidad !== 'number' || !Number.isFinite(cantidad) || cantidad === 1) {
    return descripcion;
  }
  // 1.5 se muestra como "1.5", 2 como "2": nada de "2.0 tazas".
  return `${Number(cantidad.toFixed(2))} × ${descripcion}`;
}

/**
 * Ingredientes de una receta, normalizados.
 *
 * `ingredientes` es una columna JSON: el serializador solo comprueba que sea un
 * arreglo. Una receta guardada por una versión anterior podría traer objetos o
 * `null` dentro, y eso no debe tumbar el detalle: se muestran los que sí son
 * texto.
 */
export function ingredientesDeReceta(receta: Receta): string[] {
  if (!Array.isArray(receta.ingredientes)) return [];
  return receta.ingredientes
    .filter((elemento): elemento is string => typeof elemento === 'string')
    .map((elemento) => elemento.trim())
    .filter(Boolean);
}

/**
 * Pasos de preparación.
 *
 * Se guardan como un solo texto; la nutrióloga los separa con saltos de línea y
 * a veces los numera a mano. Se corta por línea y se le quita la numeración
 * previa para no acabar con "1. 1. Calienta el agua".
 */
export function pasosDeReceta(receta: Receta): string[] {
  if (!receta.pasos) return [];
  return receta.pasos
    .split(/\r?\n+/)
    .map((paso) =>
      paso
        .trim()
        .replace(/^(?:\d+[.)]|[-•*])\s*/, '')
        .trim(),
    )
    .filter(Boolean);
}

/** kcal por porción, que es la cifra con la que el paciente decide qué comer. */
export function caloriasPorPorcion(receta: Receta): number | null {
  if (receta.calorias === null) return null;
  const porciones = receta.porciones > 0 ? receta.porciones : 1;
  return Math.round(receta.calorias / porciones);
}
