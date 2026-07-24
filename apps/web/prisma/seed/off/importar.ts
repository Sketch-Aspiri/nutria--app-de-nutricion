import { revisarCatalogo, type FilaAlimento } from '../tipos';

import { writeOffCache } from './cache';
import { mapOffProduct, type OffProduct } from './mapping';

const API_URL = 'https://world.openfoodfacts.org/api/v2/search';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REQUEST_INTERVAL_MS = 6_500;

type OffSearchResponse = {
  products?: OffProduct[];
  page_count?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(page: number, userAgent: string): Promise<OffProduct[]> {
  const url = new URL(API_URL);
  url.searchParams.set('countries_tags_en', 'mexico');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('sort_by', 'popularity_key');
  url.searchParams.set(
    'fields',
    [
      'code',
      'product_name_es',
      'product_name',
      'brands',
      'categories_tags',
      'image_front_url',
      'nutriments',
    ].join(','),
  );

  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent },
  });
  if (!response.ok) {
    throw new Error(`Open Food Facts respondió HTTP ${response.status}.`);
  }
  const body = (await response.json()) as OffSearchResponse;
  return body.products ?? [];
}

async function main(): Promise<void> {
  const userAgent = process.env.OFF_USER_AGENT?.trim();
  if (!userAgent) {
    throw new Error(
      'Define OFF_USER_AGENT con formato "Nutria/versión (contacto o URL)" antes de importar.',
    );
  }

  const target = Math.min(
    Math.max(Number(process.env.OFF_MAX_PRODUCTS) || 300, 1),
    300,
  );
  const foods: FilaAlimento[] = [];
  const refs = new Set<string>();
  let discarded = 0;

  for (let page = 1; page <= MAX_PAGES && foods.length < target; page += 1) {
    if (page > 1) await delay(REQUEST_INTERVAL_MS);
    const products = await fetchPage(page, userAgent);
    if (products.length === 0) break;

    for (const product of products) {
      const mapped = mapOffProduct(product);
      if (!mapped.ok || refs.has(mapped.food.ref)) {
        discarded += 1;
        continue;
      }
      if (revisarCatalogo([mapped.food]).length > 0) {
        discarded += 1;
        continue;
      }
      refs.add(mapped.food.ref);
      foods.push(mapped.food);
      if (foods.length === target) break;
    }
    console.info(
      `Página ${page}: ${foods.length}/${target} fichas aceptadas; ${discarded} descartadas.`,
    );
  }

  if (foods.length < target) {
    throw new Error(
      `Solo se obtuvieron ${foods.length} fichas coherentes de ${target}. No se reemplazó el cache.`,
    );
  }

  writeOffCache(foods);
  console.info(
    `Cache OFF actualizado con ${foods.length} productos. Revisa el diff antes de sembrar.`,
  );
}

main().catch((error: unknown) => {
  console.error(
    'La importación de Open Food Facts falló:',
    error instanceof Error ? error.message : 'Error desconocido',
  );
  process.exitCode = 1;
});
