import {
  EQUIVALENTE_SMAE,
  equivalentesSugeridos,
  type GrupoAlimento,
  type GrupoSmae,
  normalizarNombre,
} from '@nutria/shared';

import type { FilaAlimento } from '../tipos';

import { grupoDeUsda } from './categorias';
import { traducirDescripcion } from './traduccion';

/**
 * Traducción de un alimento de USDA FoodData Central a una fila del catálogo.
 *
 * USDA publica todo por 100 g. El nutriólogo mexicano trabaja por porción
 * equivalente, así que aquí se hace el paso que da sentido al import: elegir
 * los gramos que aportan un equivalente de su grupo, y derivar de ahí la ficha.
 */

/** Números INFOODS de los nutrimentos que guarda la ficha. */
const NUTRIMENTO = {
  energia: '208',
  proteina: '203',
  lipidos: '204',
  carbohidratos: '205',
  saturadas: '606',
  colesterol: '601',
  fibra: '291',
  azucar: '269',
  sodio: '307',
  potasio: '306',
  calcio: '301',
  hierro: '303',
  folato: '417',
  vitaminaA: '320',
  vitaminaC: '401',
} as const;

export type NutrienteUsda = {
  nutrientNumber?: string;
  number?: string;
  value?: number;
  amount?: number;
};

export type AlimentoUsda = {
  fdcId: number;
  description: string;
  foodCategory?: string | { description?: string };
  foodNutrients?: NutrienteUsda[];
};

/** Gramos permitidos por porción: menos no se pesa, más no es una porción. */
const GRAMOS_MINIMOS = 5;
const GRAMOS_MAXIMOS = 250;

/** Porción de referencia para lo que no aporta energía apreciable. */
const GRAMOS_LIBRES = 100;

/** Por debajo de esto, una porción sin equivalentes es un dato correcto. */
const KCAL_DESPRECIABLES = 20;

function valor(alimento: AlimentoUsda, numero: string): number | undefined {
  const nutriente = alimento.foodNutrients?.find(
    (candidato) => (candidato.nutrientNumber ?? candidato.number) === numero,
  );
  const cantidad = nutriente?.value ?? nutriente?.amount;
  return typeof cantidad === 'number' ? cantidad : undefined;
}

function categoria(alimento: AlimentoUsda): string {
  const bruta = alimento.foodCategory;
  if (typeof bruta === 'string') return bruta;
  return bruta?.description ?? '';
}

/** Gramos "de tabla": múltiplos de 5 abajo de 50 y de 10 arriba. */
function redondearPorcion(gramos: number): number {
  const acotado = Math.min(Math.max(gramos, GRAMOS_MINIMOS), GRAMOS_MAXIMOS);
  return acotado < 50 ? Math.round(acotado / 5) * 5 : Math.round(acotado / 10) * 10;
}

function redondear(valorNumerico: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valorNumerico * factor) / factor;
}

export type ResultadoMapeo =
  | { ok: true; fila: FilaAlimento }
  | { ok: false; motivo: string; descripcion: string };

export function mapearAlimentoUsda(alimento: AlimentoUsda): ResultadoMapeo {
  const descripcion = alimento.description ?? `fdc:${alimento.fdcId}`;

  const grupo = grupoDeUsda(categoria(alimento), descripcion);
  if (!grupo) {
    return { ok: false, motivo: 'La categoría de USDA no corresponde a ningún grupo', descripcion };
  }

  const nombre = traducirDescripcion(descripcion);
  if (!nombre) {
    return { ok: false, motivo: 'El alimento no está en el diccionario de traducción', descripcion };
  }

  const kcal100 = valor(alimento, NUTRIMENTO.energia);
  const proteina100 = valor(alimento, NUTRIMENTO.proteina);
  const lipidos100 = valor(alimento, NUTRIMENTO.lipidos);
  const carbohidratos100 = valor(alimento, NUTRIMENTO.carbohidratos);

  if (
    kcal100 === undefined ||
    proteina100 === undefined ||
    lipidos100 === undefined ||
    carbohidratos100 === undefined
  ) {
    return { ok: false, motivo: 'Faltan energía o macronutrimentos', descripcion };
  }

  const gramos = gramosDeUnEquivalente(grupo, kcal100);
  const factor = gramos / 100;
  const kcal = redondear(kcal100 * factor, 0);

  const equivalentes = equivalentesDePorcion(grupo, kcal);
  if (equivalentes === null) {
    return { ok: false, motivo: 'La porción no alcanza un cuarto de equivalente', descripcion };
  }

  const escalar = (numero: string, decimales = 2): number | undefined => {
    const bruto = valor(alimento, numero);
    return bruto === undefined ? undefined : redondear(bruto * factor, decimales);
  };

  return {
    ok: true,
    fila: {
      ref: `usda:${alimento.fdcId}`,
      nombre,
      grupo,
      porcion: `${gramos} g`,
      g: gramos,
      kcal,
      prot: redondear(proteina100 * factor),
      lip: redondear(lipidos100 * factor),
      hc: redondear(carbohidratos100 * factor),
      sat: escalar(NUTRIMENTO.saturadas),
      col: escalar(NUTRIMENTO.colesterol, 0),
      fib: escalar(NUTRIMENTO.fibra),
      azu: escalar(NUTRIMENTO.azucar),
      na: escalar(NUTRIMENTO.sodio, 0),
      k: escalar(NUTRIMENTO.potasio, 0),
      ca: escalar(NUTRIMENTO.calcio, 0),
      fe: escalar(NUTRIMENTO.hierro),
      fol: escalar(NUTRIMENTO.folato, 0),
      va: escalar(NUTRIMENTO.vitaminaA, 0),
      vc: escalar(NUTRIMENTO.vitaminaC, 1),
      eq: equivalentes,
    },
  };
}

/** Gramos que aportan ~1 equivalente del grupo, acotados a una porción real. */
function gramosDeUnEquivalente(grupo: GrupoAlimento, kcal100: number): number {
  if (grupo === 'libres' || kcal100 <= 0) return GRAMOS_LIBRES;

  const kcalEquivalente = EQUIVALENTE_SMAE[grupo as GrupoSmae].kcal;
  return redondearPorcion((kcalEquivalente / kcal100) * 100);
}

/**
 * Equivalentes reales de la porción elegida.
 *
 * Cuando el tope de 250 g impide llegar a un cuarto de equivalente, el alimento
 * solo entra si de verdad no aporta energía; declarar un 1 sería mentir.
 */
function equivalentesDePorcion(
  grupo: GrupoAlimento,
  kcal: number,
): Partial<Record<GrupoAlimento, number>> | null {
  const sugeridos = equivalentesSugeridos(grupo, kcal);
  const vacio = Object.keys(sugeridos).length === 0;

  if (vacio && grupo !== 'libres' && kcal >= KCAL_DESPRECIABLES) return null;
  return sugeridos;
}

/** Dos alimentos de USDA pueden traducirse al mismo nombre y porción. */
export function claveDeDuplicado(fila: FilaAlimento): string {
  return `${normalizarNombre(fila.nombre)}|${fila.g}`;
}
