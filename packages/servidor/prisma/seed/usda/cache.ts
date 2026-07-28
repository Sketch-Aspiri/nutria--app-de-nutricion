import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { FilaAlimento } from '../tipos';

/**
 * El resultado del import de USDA se versiona en el repositorio.
 *
 * Así la siembra es reproducible y no depende de la red ni de una llave de API:
 * `npm run db:seed` corre igual en CI, en un branch de preview y en la laptop de
 * quien acaba de clonar. Volver a llamar a USDA es un paso explícito
 * (`npm run db:import:usda`) que actualiza este archivo y se revisa como código.
 */

export const RUTA_CACHE_USDA = path.join(import.meta.dirname, 'alimentos-usda.json');

export type CacheUsda = {
  generado_en: string;
  total: number;
  alimentos: FilaAlimento[];
};

export function leerCacheUsda(): FilaAlimento[] {
  if (!existsSync(RUTA_CACHE_USDA)) return [];

  const contenido = JSON.parse(readFileSync(RUTA_CACHE_USDA, 'utf8')) as CacheUsda;
  return contenido.alimentos ?? [];
}

export function escribirCacheUsda(alimentos: FilaAlimento[]): void {
  const contenido: CacheUsda = {
    generado_en: new Date().toISOString(),
    total: alimentos.length,
    alimentos,
  };

  writeFileSync(RUTA_CACHE_USDA, `${JSON.stringify(contenido, null, 2)}\n`, 'utf8');
}
