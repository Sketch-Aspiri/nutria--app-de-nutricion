/**
 * Sistema Mexicano de Alimentos Equivalentes (SMAE): el nutriólogo no receta
 * "120 g de proteína", receta "6 equivalentes de alimento de origen animal".
 *
 * Los valores por equivalente son los promedios por grupo publicados por el
 * sistema; no reproducen el listado de alimentos de la obra (que es material
 * con derechos), solo la aritmética de los grupos.
 */

export type GrupoSmae =
  | 'verduras'
  | 'frutas'
  | 'cereales'
  | 'leguminosas'
  | 'origen_animal'
  | 'leche'
  | 'aceites'
  | 'azucares';

export type AporteEquivalente = {
  nombre: string;
  kcal: number;
  proteina: number;
  hidratos: number;
  lipidos: number;
};

/** Aporte de UN equivalente de cada grupo (subgrupo de referencia). */
export const EQUIVALENTE_SMAE: Record<GrupoSmae, AporteEquivalente> = {
  verduras: { nombre: 'Verduras', kcal: 25, proteina: 2, hidratos: 4, lipidos: 0 },
  frutas: { nombre: 'Frutas', kcal: 60, proteina: 0, hidratos: 15, lipidos: 0 },
  cereales: { nombre: 'Cereales sin grasa', kcal: 70, proteina: 2, hidratos: 15, lipidos: 0 },
  leguminosas: { nombre: 'Leguminosas', kcal: 120, proteina: 8, hidratos: 20, lipidos: 1 },
  origen_animal: {
    nombre: 'Origen animal bajo en grasa',
    kcal: 55,
    proteina: 7,
    hidratos: 0,
    lipidos: 3,
  },
  leche: { nombre: 'Leche descremada', kcal: 95, proteina: 9, hidratos: 12, lipidos: 2 },
  aceites: { nombre: 'Aceites y grasas', kcal: 45, proteina: 0, hidratos: 0, lipidos: 5 },
  azucares: { nombre: 'Azúcares sin grasa', kcal: 40, proteina: 0, hidratos: 10, lipidos: 0 },
};

export const GRUPOS_SMAE: GrupoSmae[] = Object.keys(EQUIVALENTE_SMAE) as GrupoSmae[];

/**
 * Piso de equivalentes que un plan mexicano equilibrado no debería bajar:
 * verduras y frutas por fibra y micronutrimentos, leche por calcio,
 * leguminosas por ser la base proteica y económica de la dieta local.
 */
export const MINIMOS_POR_DEFECTO: Record<GrupoSmae, number> = {
  verduras: 3,
  frutas: 3,
  leguminosas: 1,
  leche: 2,
  cereales: 0,
  origen_animal: 0,
  aceites: 0,
  azucares: 0,
};

export type MetaMacros = {
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
};

export type RenglonEquivalentes = {
  grupo: GrupoSmae;
  nombre: string;
  equivalentes: number;
  kcal: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
};

export type DistribucionEquivalentes = {
  renglones: RenglonEquivalentes[];
  totales: MetaMacros;
  /** Diferencia total − meta. Positiva = el reparto se pasa de la meta. */
  desviacion: MetaMacros & { kcalPct: number };
  advertencias: string[];
};

/** Los equivalentes se recetan en medios: 2.5 tortillas es una indicación real. */
const PASO_EQUIVALENTE = 0.5;

function aMedios(valor: number): number {
  return Math.max(0, Math.round(valor / PASO_EQUIVALENTE) * PASO_EQUIVALENTE);
}

/**
 * `Math.round(-0.2)` da `-0`, que `JSON.stringify` convierte en `0`: el snapshot
 * dejaría de ser idéntico a sí mismo tras un viaje por la base. `|| 0` lo normaliza.
 */
function entero(valor: number): number {
  return Math.round(valor) || 0;
}

function acumular(conteo: Record<GrupoSmae, number>): MetaMacros {
  return GRUPOS_SMAE.reduce<MetaMacros>(
    (total, grupo) => {
      const cantidad = conteo[grupo];
      const aporte = EQUIVALENTE_SMAE[grupo];
      return {
        kcal: total.kcal + cantidad * aporte.kcal,
        proteina_g: total.proteina_g + cantidad * aporte.proteina,
        carbos_g: total.carbos_g + cantidad * aporte.hidratos,
        grasa_g: total.grasa_g + cantidad * aporte.lipidos,
      };
    },
    { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0 },
  );
}

const TOLERANCIA_KCAL_PCT = 5;

/**
 * Reparte una meta de calorías y macros en equivalentes SMAE por grupo.
 *
 * Sigue el orden con que se enseña en consulta: se fijan los mínimos de
 * verduras, frutas, leguminosas y leche; los hidratos restantes se cubren con
 * cereales, la proteína faltante con alimentos de origen animal y los lípidos
 * faltantes con aceites. Cuando los mínimos ya exceden un macro, el grupo
 * correspondiente queda en cero y la desviación se reporta — nunca se restan
 * equivalentes de los mínimos en silencio.
 */
export function distribuirEquivalentes(
  meta: MetaMacros,
  opciones?: { minimos?: Partial<Record<GrupoSmae, number>> },
): DistribucionEquivalentes {
  if (
    !Number.isFinite(meta.kcal) ||
    meta.kcal <= 0 ||
    meta.proteina_g < 0 ||
    meta.carbos_g < 0 ||
    meta.grasa_g < 0
  ) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }

  const advertencias: string[] = [];
  const conteo: Record<GrupoSmae, number> = { ...MINIMOS_POR_DEFECTO, ...opciones?.minimos };
  for (const grupo of GRUPOS_SMAE) {
    conteo[grupo] = aMedios(conteo[grupo]);
  }

  const hidratosBase = acumular(conteo).carbos_g;
  conteo.cereales = aMedios(
    conteo.cereales + (meta.carbos_g - hidratosBase) / EQUIVALENTE_SMAE.cereales.hidratos,
  );
  if (meta.carbos_g < hidratosBase) {
    advertencias.push(
      'Los mínimos de verduras, frutas, leguminosas y leche ya cubren los hidratos de la meta: no quedan cereales por repartir.',
    );
  }

  const proteinaBase = acumular(conteo).proteina_g;
  conteo.origen_animal = aMedios(
    conteo.origen_animal + (meta.proteina_g - proteinaBase) / EQUIVALENTE_SMAE.origen_animal.proteina,
  );
  if (meta.proteina_g < proteinaBase) {
    advertencias.push(
      'Los grupos base ya cubren la proteína de la meta: no se agregaron alimentos de origen animal.',
    );
  }

  const lipidosBase = acumular(conteo).grasa_g;
  conteo.aceites = aMedios(
    conteo.aceites + (meta.grasa_g - lipidosBase) / EQUIVALENTE_SMAE.aceites.lipidos,
  );
  if (meta.grasa_g < lipidosBase) {
    advertencias.push(
      'Los grupos base ya aportan la grasa de la meta: no se agregaron aceites.',
    );
  }

  const totales = acumular(conteo);
  const desviacionKcal = totales.kcal - meta.kcal;
  const kcalPct = Math.round((desviacionKcal / meta.kcal) * 1000) / 10;

  if (Math.abs(kcalPct) > TOLERANCIA_KCAL_PCT) {
    advertencias.push(
      `El reparto queda a ${kcalPct > 0 ? '+' : ''}${kcalPct}% de las calorías objetivo. Ajusta los mínimos por grupo.`,
    );
  }

  return {
    renglones: GRUPOS_SMAE.map((grupo) => {
      const aporte = EQUIVALENTE_SMAE[grupo];
      const cantidad = conteo[grupo];
      return {
        grupo,
        nombre: aporte.nombre,
        equivalentes: cantidad,
        kcal: entero(cantidad * aporte.kcal),
        proteina_g: entero(cantidad * aporte.proteina),
        carbos_g: entero(cantidad * aporte.hidratos),
        grasa_g: entero(cantidad * aporte.lipidos),
      };
    }),
    totales: {
      kcal: entero(totales.kcal),
      proteina_g: entero(totales.proteina_g),
      carbos_g: entero(totales.carbos_g),
      grasa_g: entero(totales.grasa_g),
    },
    desviacion: {
      kcal: entero(desviacionKcal),
      kcalPct: kcalPct || 0,
      proteina_g: entero(totales.proteina_g - meta.proteina_g),
      carbos_g: entero(totales.carbos_g - meta.carbos_g),
      grasa_g: entero(totales.grasa_g - meta.grasa_g),
    },
    advertencias,
  };
}
