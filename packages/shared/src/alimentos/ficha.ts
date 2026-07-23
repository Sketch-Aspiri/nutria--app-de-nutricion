import type { FuenteAlimento, GrupoAlimento } from './grupos';

/**
 * Ficha nutrimental de un alimento de la base.
 *
 * Los campos opcionales son `null`, nunca `0`: que un alimento no tenga
 * capturado el sodio no significa que no aporte sodio, y un cero silencioso
 * falsearía el total de un plan.
 */

export type Equivalentes = Partial<Record<GrupoAlimento, number>>;

/** Aporte de UNA porción. Todo lo que puede faltar es `null`. */
export type Nutrimentos = {
  energia_kcal: number;
  proteina_g: number;
  lipidos_g: number;
  carbohidratos_g: number;
  saturadas_g: number | null;
  colesterol_mg: number | null;
  fibra_g: number | null;
  azucar_g: number | null;
  sodio_mg: number | null;
  potasio_mg: number | null;
  calcio_mg: number | null;
  hierro_mg: number | null;
  acido_folico_ug: number | null;
  vitamina_a_ug: number | null;
  vitamina_c_mg: number | null;
};

export type AlimentoFicha = Nutrimentos & {
  id: string;
  nombre: string;
  grupo: GrupoAlimento;
  subgrupo: string | null;
  porcion_descripcion: string;
  porcion_gramos: number;
  indice_glicemico: number | null;
  equivalentes: Equivalentes;
  imagen_url: string | null;
  fuente: FuenteAlimento;
  /** `true` si lo capturó el nutriólogo que consulta (puede editarlo y borrarlo). */
  es_propio: boolean;
};

/** Las cuatro primeras siempre traen valor; el resto puede venir en `null`. */
export const CAMPOS_NUTRIMENTOS: (keyof Nutrimentos)[] = [
  'energia_kcal',
  'proteina_g',
  'lipidos_g',
  'carbohidratos_g',
  'saturadas_g',
  'colesterol_mg',
  'fibra_g',
  'azucar_g',
  'sodio_mg',
  'potasio_mg',
  'calcio_mg',
  'hierro_mg',
  'acido_folico_ug',
  'vitamina_a_ug',
  'vitamina_c_mg',
];

/** Nombre legible de cada nutrimento, con su unidad, para la ficha y el PDF. */
export const NOMBRE_NUTRIMENTO: Record<keyof Nutrimentos, string> = {
  energia_kcal: 'Energía (kcal)',
  proteina_g: 'Proteína (g)',
  lipidos_g: 'Lípidos (g)',
  carbohidratos_g: 'Hidratos de carbono (g)',
  saturadas_g: 'Grasa saturada (g)',
  colesterol_mg: 'Colesterol (mg)',
  fibra_g: 'Fibra (g)',
  azucar_g: 'Azúcares (g)',
  sodio_mg: 'Sodio (mg)',
  potasio_mg: 'Potasio (mg)',
  calcio_mg: 'Calcio (mg)',
  hierro_mg: 'Hierro (mg)',
  acido_folico_ug: 'Ácido fólico (µg)',
  vitamina_a_ug: 'Vitamina A (µg ER)',
  vitamina_c_mg: 'Vitamina C (mg)',
};

/** Dos decimales: más precisión que esa es ruido en una tabla de composición. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export type PorcionEscalada = Nutrimentos & {
  gramos: number;
  equivalentes: Equivalentes;
};

/**
 * Multiplica la ficha por la cantidad de porciones recetada.
 *
 * Un nutrimento sin capturar sigue sin capturar: escalar `null` da `null`.
 */
export function escalarAlimento(
  alimento: Nutrimentos & Pick<AlimentoFicha, 'porcion_gramos' | 'equivalentes'>,
  porciones: number,
): PorcionEscalada {
  if (!Number.isFinite(porciones) || porciones < 0) {
    throw new Error('La cantidad de porciones debe ser un número positivo.');
  }

  const escalado: Record<string, number | null> = {};
  for (const campo of CAMPOS_NUTRIMENTOS) {
    const valor = alimento[campo];
    escalado[campo] = valor === null ? null : redondear(valor * porciones);
  }

  const equivalentes: Equivalentes = {};
  for (const [grupo, cantidad] of Object.entries(alimento.equivalentes)) {
    equivalentes[grupo as GrupoAlimento] = redondear(cantidad * porciones);
  }

  return {
    // Energía y macros nunca entran en `null`, así que tampoco salen: el cast
    // afirma ese invariante, que el `Record` genérico del acumulador pierde.
    ...(escalado as unknown as Nutrimentos),
    gramos: redondear(alimento.porcion_gramos * porciones),
    equivalentes,
  };
}

/** Margen de la comprobación de Atwater: redondeos, polioles, fibra, alcohol. */
export const TOLERANCIA_ATWATER = 0.2;
export const MARGEN_ATWATER_KCAL = 20;

export type RevisionEnergia = {
  kcal_ficha: number;
  kcal_macronutrimentos: number;
  coherente: boolean;
  motivo: string | null;
};

/**
 * Compara la energía declarada contra la que implican los macronutrimentos
 * (4 kcal/g de proteína e hidratos, 9 kcal/g de lípidos).
 *
 * Atrapa la errata de dedo antes de que llegue al plan de un paciente: una
 * fila con 700 kcal y 7 g de macros no la detecta ninguna otra validación.
 */
export function verificarEnergia(
  alimento: Pick<
    Nutrimentos,
    'energia_kcal' | 'proteina_g' | 'lipidos_g' | 'carbohidratos_g'
  >,
): RevisionEnergia {
  const estimadas =
    alimento.proteina_g * 4 + alimento.carbohidratos_g * 4 + alimento.lipidos_g * 9;
  const diferencia = Math.abs(estimadas - alimento.energia_kcal);
  const margen = Math.max(alimento.energia_kcal * TOLERANCIA_ATWATER, MARGEN_ATWATER_KCAL);
  const coherente = diferencia <= margen;

  return {
    kcal_ficha: alimento.energia_kcal,
    kcal_macronutrimentos: Math.round(estimadas),
    coherente,
    motivo: coherente
      ? null
      : `Los macronutrimentos suman ${Math.round(estimadas)} kcal y la ficha declara ${alimento.energia_kcal} kcal.`,
  };
}

export type TotalNutrimentos = Nutrimentos & {
  gramos: number;
  equivalentes: Equivalentes;
  /**
   * Nutrimentos que al menos un alimento no tenía capturados: el total es un
   * piso, no el valor real. La UI lo marca en lugar de presentar el número
   * como si estuviera completo.
   */
  incompletos: (keyof Nutrimentos)[];
};

/** Suma las porciones ya escaladas de una comida o de un plan completo. */
export function sumarNutrimentos(porciones: PorcionEscalada[]): TotalNutrimentos {
  const total: Record<string, number> = {};
  const incompletos: (keyof Nutrimentos)[] = [];

  for (const campo of CAMPOS_NUTRIMENTOS) {
    const valores = porciones.map((porcion) => porcion[campo]);
    if (valores.some((valor) => valor === null)) incompletos.push(campo);

    const suma = valores.reduce<number>((acumulado, valor) => acumulado + (valor ?? 0), 0);
    total[campo] = redondear(suma);
  }

  const equivalentes: Equivalentes = {};
  for (const porcion of porciones) {
    for (const [grupo, cantidad] of Object.entries(porcion.equivalentes)) {
      const clave = grupo as GrupoAlimento;
      equivalentes[clave] = redondear((equivalentes[clave] ?? 0) + cantidad);
    }
  }

  return {
    // Los faltantes se sumaron como cero y se reportan en `incompletos`.
    ...(total as unknown as Nutrimentos),
    gramos: redondear(porciones.reduce((suma, porcion) => suma + porcion.gramos, 0)),
    equivalentes,
    incompletos,
  };
}
