import {
  EQUIVALENTE_SMAE,
  equivalentesSugeridos,
  type GrupoAlimento,
  type GrupoSmae,
  normalizarNombre,
} from '@nutria/shared';

import type { FilaAlimento } from '../tipos';

export type OffProduct = {
  code?: string;
  product_name_es?: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  image_front_url?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const GROUP_PATTERNS: Array<[GrupoAlimento, RegExp]> = [
  ['leche', /milk|dair|yogurt|cheese|lacteo|leche|queso|yogur/],
  [
    'origen_animal',
    /meat|fish|seafood|egg|poultry|beef|pork|chicken|carne|pescado|huevo|pollo|atun/,
  ],
  ['leguminosas', /legume|bean|lentil|chickpea|frijol|lenteja|garbanzo/],
  ['frutas', /fruit|fruta/],
  ['verduras', /vegetable|verdura|hortaliza/],
  ['aceites', /oil|fat|nut|seed|aceite|nuez|semilla|cacahuate/],
  [
    'azucares',
    /sweet|candy|chocolate|dessert|soda|soft-drink|sugar|dulce|postre|refresco|azucar/,
  ],
  [
    'cereales',
    /cereal|bread|pasta|rice|tortilla|cookie|biscuit|flour|pan|arroz|galleta|harina/,
  ],
];

const MIN_GRAMS = 5;
const MAX_GRAMS = 250;

function numberValue(
  nutrients: OffProduct['nutriments'],
  key: string,
): number | undefined {
  const value = nutrients?.[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function groupFor(product: OffProduct): GrupoAlimento | null {
  const categories = normalizarNombre(
    (product.categories_tags ?? []).join(' '),
  );
  return (
    GROUP_PATTERNS.find(([, pattern]) => pattern.test(categories))?.[0] ?? null
  );
}

function portionGrams(group: GrupoAlimento, kcal100: number): number {
  if (group === 'libres' || kcal100 <= 0) return 100;
  const target = EQUIVALENTE_SMAE[group as GrupoSmae].kcal;
  const raw = (target / kcal100) * 100;
  const clamped = Math.min(Math.max(raw, MIN_GRAMS), MAX_GRAMS);
  return clamped < 50
    ? Math.max(Math.round(clamped / 5) * 5, MIN_GRAMS)
    : Math.round(clamped / 10) * 10;
}

export type OffMappingResult =
  | { ok: true; food: FilaAlimento }
  | { ok: false; reason: string };

/** Convierte una ficha por 100 g a una porción clínica de referencia. */
export function mapOffProduct(product: OffProduct): OffMappingResult {
  const code = product.code?.trim();
  const baseName = (product.product_name_es ?? product.product_name)?.trim();
  const group = groupFor(product);
  if (!code || !/^\d{8,14}$/.test(code)) {
    return { ok: false, reason: 'barcode inválido' };
  }
  if (!baseName || !group) {
    return { ok: false, reason: 'sin nombre o grupo reconocido' };
  }

  const kcal100 =
    numberValue(product.nutriments, 'energy-kcal_100g') ??
    ((numberValue(product.nutriments, 'energy-kj_100g') ?? 0) / 4.184);
  const protein100 = numberValue(product.nutriments, 'proteins_100g');
  const fat100 = numberValue(product.nutriments, 'fat_100g');
  const carbs100 = numberValue(product.nutriments, 'carbohydrates_100g');
  if (
    kcal100 <= 0 ||
    protein100 === undefined ||
    fat100 === undefined ||
    carbs100 === undefined
  ) {
    return { ok: false, reason: 'sin energía o macronutrimentos completos' };
  }

  const grams = portionGrams(group, kcal100);
  const factor = grams / 100;
  const kcal = round(kcal100 * factor, 0);
  const equivalents = equivalentesSugeridos(group, kcal);
  if (Object.keys(equivalents).length === 0 && kcal >= 20) {
    return { ok: false, reason: 'porción sin equivalente' };
  }

  const optional = (
    key: string,
    multiplier = 1,
    decimals = 2,
  ): number | undefined => {
    const value = numberValue(product.nutriments, key);
    return value === undefined
      ? undefined
      : round(value * factor * multiplier, decimals);
  };

  const brand = product.brands?.split(',')[0]?.trim();
  const name = brand ? `${baseName} — ${brand}` : baseName;
  return {
    ok: true,
    food: {
      ref: `off:${code}`,
      nombre: name.slice(0, 180),
      grupo: group,
      porcion: `${grams} g (porción de referencia)`,
      g: grams,
      kcal,
      prot: round(protein100 * factor),
      lip: round(fat100 * factor),
      hc: round(carbs100 * factor),
      sat: optional('saturated-fat_100g'),
      fib: optional('fiber_100g'),
      azu: optional('sugars_100g'),
      na: optional('sodium_100g', 1_000, 0),
      eq: equivalents,
      imagen: product.image_front_url,
    },
  };
}
