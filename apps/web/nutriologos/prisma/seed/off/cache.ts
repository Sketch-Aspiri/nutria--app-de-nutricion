import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { FilaAlimento } from '../tipos';

export const OFF_CACHE_PATH = path.join(
  import.meta.dirname,
  'alimentos-off.json',
);

type OffCache = {
  generated_at: string;
  source: 'Open Food Facts';
  license: 'ODbL-1.0';
  total: number;
  foods: FilaAlimento[];
};

export function readOffCache(): FilaAlimento[] {
  if (!existsSync(OFF_CACHE_PATH)) return [];
  const cache = JSON.parse(readFileSync(OFF_CACHE_PATH, 'utf8')) as OffCache;
  return cache.foods ?? [];
}

export function writeOffCache(foods: FilaAlimento[]): void {
  const cache: OffCache = {
    generated_at: new Date().toISOString(),
    source: 'Open Food Facts',
    license: 'ODbL-1.0',
    total: foods.length,
    foods,
  };
  writeFileSync(
    OFF_CACHE_PATH,
    `${JSON.stringify(cache, null, 2)}\n`,
    'utf8',
  );
}
