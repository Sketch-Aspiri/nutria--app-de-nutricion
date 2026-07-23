import { EQUIVALENTE_SMAE, type GrupoSmae } from '../nutricion/equivalentes';

import type { GrupoAlimento } from './grupos';
import type { Equivalentes, Nutrimentos } from './ficha';

/**
 * Puente entre la ficha nutrimental de un alimento y su valor en equivalentes.
 *
 * El nutriólogo receta "2 equivalentes de cereal", no "140 kcal". Cada alimento
 * declara a cuántos equivalentes corresponde su porción, y esa declaración tiene
 * que ser coherente con sus macros: si no lo es, el plan cuadra en equivalentes
 * pero no en calorías. `verificarEquivalentes` es la reja que atrapa la
 * incoherencia antes de que entre a la base.
 */

export type MacrosEquivalentes = {
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
};

/** `libres` no aporta: por definición es el grupo de energía despreciable. */
export function macrosDeEquivalentes(equivalentes: Equivalentes): MacrosEquivalentes {
  const total: MacrosEquivalentes = {
    energia_kcal: 0,
    proteina_g: 0,
    carbohidratos_g: 0,
    lipidos_g: 0,
  };

  for (const [grupo, cantidad] of Object.entries(equivalentes)) {
    const aporte = EQUIVALENTE_SMAE[grupo as GrupoSmae];
    if (!aporte || !cantidad) continue;

    total.energia_kcal += aporte.kcal * cantidad;
    total.proteina_g += aporte.proteina * cantidad;
    total.carbohidratos_g += aporte.hidratos * cantidad;
    total.lipidos_g += aporte.lipidos * cantidad;
  }

  return total;
}

/** Los equivalentes se recetan en cuartos; más fino no se usa en consulta. */
const PASO_EQUIVALENTE = 0.25;

/**
 * Equivalentes que le corresponden a una porción por su sola aritmética.
 *
 * Es el punto de partida cuando nadie los declaró: el import de USDA y el alta
 * de un alimento propio la usan igual. No es una decisión clínica —el grupo lo
 * eligió una persona—, solo el reparto de la energía en cuartos de equivalente.
 */
export function equivalentesSugeridos(
  grupo: GrupoAlimento,
  energiaKcal: number,
): Equivalentes {
  if (grupo === 'libres') return {};

  const kcalEquivalente = EQUIVALENTE_SMAE[grupo as GrupoSmae].kcal;
  const cantidad =
    Math.round(energiaKcal / kcalEquivalente / PASO_EQUIVALENTE) * PASO_EQUIVALENTE;

  return cantidad < PASO_EQUIVALENTE ? {} : { [grupo]: cantidad };
}

/**
 * Margen aceptable entre las kcal reales del alimento y las que implican sus
 * equivalentes. El sistema trabaja con promedios por grupo, así que un 25 % de
 * diferencia es normal; más que eso delata un equivalente mal asignado.
 */
export const TOLERANCIA_EQUIVALENTES = 0.25;

/**
 * Margen absoluto que se suma al relativo.
 *
 * Una verdura de 14 kcal se cuenta como un equivalente de 25 kcal y eso es
 * correcto en el sistema; sin este piso, la revisión rechazaría media sección
 * de verduras por una diferencia de 11 kcal que a nadie le mueve el plan.
 */
export const MARGEN_EQUIVALENTES_KCAL = 15;

/** Debajo de este aporte la desviación relativa deja de ser informativa. */
const KCAL_MINIMAS_COMPARABLES = 20;

export type RevisionEquivalentes = {
  kcal_ficha: number;
  kcal_equivalentes: number;
  /** Diferencia relativa contra las kcal de la ficha (0.3 = 30 % de más o de menos). */
  desviacion: number;
  coherente: boolean;
  motivo: string | null;
};

export function verificarEquivalentes(
  alimento: Pick<Nutrimentos, 'energia_kcal'> & { equivalentes: Equivalentes },
  tolerancia = TOLERANCIA_EQUIVALENTES,
): RevisionEquivalentes {
  const kcalFicha = alimento.energia_kcal;
  const kcalEquivalentes = macrosDeEquivalentes(alimento.equivalentes).energia_kcal;
  const sinEquivalentes = Object.values(alimento.equivalentes).every((valor) => !valor);

  // Un alimento libre de energía no declara equivalentes: comparar contra cero
  // daría siempre 100 % de desviación.
  if (sinEquivalentes && kcalFicha < KCAL_MINIMAS_COMPARABLES) {
    return {
      kcal_ficha: kcalFicha,
      kcal_equivalentes: 0,
      desviacion: 0,
      coherente: true,
      motivo: null,
    };
  }

  if (sinEquivalentes) {
    return {
      kcal_ficha: kcalFicha,
      kcal_equivalentes: 0,
      desviacion: 1,
      coherente: false,
      motivo: `Aporta ${kcalFicha} kcal pero no declara ningún equivalente.`,
    };
  }

  const diferencia = Math.abs(kcalEquivalentes - kcalFicha);
  const desviacion = diferencia / Math.max(kcalFicha, 1);
  const coherente =
    desviacion <= tolerancia || diferencia <= MARGEN_EQUIVALENTES_KCAL;

  return {
    kcal_ficha: kcalFicha,
    kcal_equivalentes: Math.round(kcalEquivalentes),
    desviacion: Math.round(desviacion * 100) / 100,
    coherente,
    motivo: coherente
      ? null
      : `Los equivalentes declarados suman ${Math.round(kcalEquivalentes)} kcal y la ficha ${kcalFicha} kcal.`,
  };
}
