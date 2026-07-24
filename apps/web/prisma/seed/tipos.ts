import type { FoodSource, Prisma } from '@prisma/client';

import {
  type Equivalentes,
  type FuenteAlimento,
  type GrupoAlimento,
  normalizarNombre,
  verificarEnergia,
  verificarEquivalentes,
} from '@nutria/shared';

/**
 * Fila del catálogo de siembra.
 *
 * Los nombres van abreviados a propósito: una tabla de composición son ~160
 * renglones por 20 columnas, y `acido_folico_ug` repetido 160 veces la vuelve
 * ilegible. La abreviatura de cada columna se documenta aquí una vez.
 *
 * Toda cantidad es **por porción**, no por 100 g. Lo que no está capturado se
 * omite y llega a la base como `null`: un cero afirmaría que el alimento no
 * aporta ese nutrimento.
 */
export type FilaAlimento = {
  /** Identidad estable dentro de la fuente. Hace idempotente el seed. */
  ref: string;
  nombre: string;
  grupo: GrupoAlimento;
  /** Subgrupo SMAE ("con grasa", "bajo aporte de grasa"). */
  subgrupo?: string;
  /** Medida casera: "1 pieza", "1/2 taza". */
  porcion: string;
  /** Gramos de esa medida casera. */
  g: number;
  kcal: number;
  /** Proteína (g). */
  prot: number;
  /** Lípidos (g). */
  lip: number;
  /** Hidratos de carbono (g). */
  hc: number;
  /** Grasa saturada (g). */
  sat?: number;
  /** Colesterol (mg). */
  col?: number;
  /** Fibra (g). */
  fib?: number;
  /** Azúcares (g). */
  azu?: number;
  /** Sodio (mg). */
  na?: number;
  /** Potasio (mg). */
  k?: number;
  /** Calcio (mg). */
  ca?: number;
  /** Hierro (mg). */
  fe?: number;
  /** Ácido fólico (µg). */
  fol?: number;
  /** Vitamina A (µg ER). */
  va?: number;
  /** Vitamina C (mg). */
  vc?: number;
  /** Índice glicémico. */
  ig?: number;
  /** Equivalentes SMAE que aporta la porción. */
  eq: Equivalentes;
  /** Imagen de la fuente con licencia y atribución documentadas. */
  imagen?: string;
};

/** `undefined` (no capturado) y `null` (sin dato) son lo mismo para la base. */
function opcional(valor: number | undefined): number | null {
  return valor ?? null;
}

/** El dominio nombra la fuente en minúsculas; el enum de Prisma, en mayúsculas. */
const FUENTE_EN_BASE: Record<FuenteAlimento, FoodSource> = {
  incmnsz: 'INCMNSZ',
  usda: 'USDA',
  off: 'OFF',
  propia: 'PROPIA',
};

export function fuenteEnBase(fuente: FuenteAlimento): FoodSource {
  return FUENTE_EN_BASE[fuente];
}

export function filaAAlimento(
  fila: FilaAlimento,
  fuente: FuenteAlimento,
): Prisma.FoodCreateInput {
  return {
    nombre: fila.nombre,
    nombreNormalizado: normalizarNombre(fila.nombre),
    grupoSmae: fila.grupo,
    subgrupo: fila.subgrupo ?? null,
    porcionDescripcion: fila.porcion,
    porcionGramos: fila.g,
    energiaKcal: fila.kcal,
    proteinaG: fila.prot,
    lipidosG: fila.lip,
    carbohidratosG: fila.hc,
    saturadasG: opcional(fila.sat),
    colesterolMg: opcional(fila.col),
    fibraG: opcional(fila.fib),
    azucarG: opcional(fila.azu),
    sodioMg: opcional(fila.na),
    potasioMg: opcional(fila.k),
    calcioMg: opcional(fila.ca),
    hierroMg: opcional(fila.fe),
    acidoFolicoUg: opcional(fila.fol),
    vitaminaAUg: opcional(fila.va),
    vitaminaCMg: opcional(fila.vc),
    indiceGlicemico: opcional(fila.ig),
    equivalentes: fila.eq,
    imagenUrl: fila.imagen ?? null,
    fuente: fuenteEnBase(fuente),
    fuenteRef: fila.ref,
    esPublico: true,
  };
}

export type ProblemaCatalogo = { ref: string; motivo: string };

/**
 * Revisión del catálogo antes de escribirlo.
 *
 * Una tabla de composición capturada a mano acumula erratas de dedo, y una
 * errata aquí se propaga a los planes de todos los pacientes. Se verifican dos
 * invariantes independientes: que los equivalentes declarados correspondan a la
 * energía de la ficha, y que la energía corresponda a los macronutrimentos.
 */
export function revisarCatalogo(filas: FilaAlimento[]): ProblemaCatalogo[] {
  const problemas: ProblemaCatalogo[] = [];
  const refs = new Set<string>();

  for (const fila of filas) {
    if (refs.has(fila.ref)) {
      problemas.push({ ref: fila.ref, motivo: 'La referencia está repetida en el catálogo.' });
    }
    refs.add(fila.ref);

    if (fila.g <= 0) {
      problemas.push({ ref: fila.ref, motivo: 'La porción tiene que pesar más de cero gramos.' });
    }

    const revision = verificarEquivalentes({
      energia_kcal: fila.kcal,
      equivalentes: fila.eq,
    });
    if (!revision.coherente && revision.motivo) {
      problemas.push({ ref: fila.ref, motivo: revision.motivo });
    }

    const atwater = verificarEnergia({
      energia_kcal: fila.kcal,
      proteina_g: fila.prot,
      lipidos_g: fila.lip,
      carbohidratos_g: fila.hc,
    });
    if (!atwater.coherente && atwater.motivo) {
      problemas.push({ ref: fila.ref, motivo: atwater.motivo });
    }
  }

  return problemas;
}
