import { PrismaClient } from '@prisma/client';

import type { FuenteAlimento } from '@nutria/shared';

import { NUCLEO_MX } from './datos/nucleo-mx';
import { readOffCache } from './off/cache';
import { filaAAlimento, fuenteEnBase, revisarCatalogo, type FilaAlimento } from './tipos';
import { leerCacheUsda } from './usda/cache';

/**
 * Siembra de la base de alimentos pública.
 *
 * Es idempotente: cada alimento se identifica por `(fuente, fuente_ref)`, así
 * que correrla de nuevo actualiza los valores en lugar de duplicar el catálogo.
 * Eso permite ejecutarla en cada deploy y en cada branch de preview de Neon.
 *
 *   npm run db:seed              # todas las tandas disponibles
 *   npm run db:seed -- --tanda=nucleo
 */

const prisma = new PrismaClient();

/** Escrituras simultáneas: suficiente para ir rápido sin saturar el pool. */
const TAMANO_LOTE = 10;

type Tanda = {
  clave: string;
  descripcion: string;
  fuente: FuenteAlimento;
  filas: () => FilaAlimento[];
};

const TANDAS: Tanda[] = [
  {
    clave: 'nucleo',
    descripcion: 'Núcleo de alimentos mexicanos capturado y verificado a mano',
    fuente: 'incmnsz',
    filas: () => NUCLEO_MX,
  },
  {
    clave: 'usda',
    descripcion: 'Importación de USDA FoodData Central',
    fuente: 'usda',
    filas: leerCacheUsda,
  },
  {
    clave: 'off',
    descripcion:
      'Productos empacados de Open Food Facts (ODbL 1.0, México)',
    fuente: 'off',
    filas: readOffCache,
  },
];

async function sembrarTanda(tanda: Tanda): Promise<number> {
  const filas = tanda.filas();

  if (filas.length === 0) {
    console.info(`  ${tanda.clave}: sin datos disponibles, se omite.`);
    return 0;
  }

  const problemas = revisarCatalogo(filas);
  if (problemas.length > 0) {
    for (const problema of problemas) {
      console.error(`  ✗ ${problema.ref}: ${problema.motivo}`);
    }
    throw new Error(
      `La tanda "${tanda.clave}" tiene ${problemas.length} alimento(s) incoherente(s). No se escribió nada.`,
    );
  }

  for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
    const lote = filas.slice(inicio, inicio + TAMANO_LOTE);
    await Promise.all(lote.map((fila) => guardar(fila, tanda.fuente)));
  }

  return filas.length;
}

function guardar(fila: FilaAlimento, fuente: FuenteAlimento) {
  const datos = filaAAlimento(fila, fuente);

  return prisma.food.upsert({
    where: { fuente_fuenteRef: { fuente: fuenteEnBase(fuente), fuenteRef: fila.ref } },
    create: datos,
    // `deletedAt` se deja como está: si alguien retiró un alimento del catálogo,
    // volver a correr la siembra no debe resucitarlo.
    update: datos,
  });
}

async function main(): Promise<void> {
  const pedida = process.argv
    .find((argumento) => argumento.startsWith('--tanda='))
    ?.split('=')[1];

  const tandas = pedida ? TANDAS.filter((tanda) => tanda.clave === pedida) : TANDAS;

  if (tandas.length === 0) {
    const claves = TANDAS.map((tanda) => tanda.clave).join(', ');
    throw new Error(`No existe la tanda "${pedida}". Disponibles: ${claves}.`);
  }

  console.info('Sembrando la base de alimentos...');

  let total = 0;
  for (const tanda of tandas) {
    console.info(`\n${tanda.clave} — ${tanda.descripcion}`);
    const escritos = await sembrarTanda(tanda);
    total += escritos;
    if (escritos > 0) console.info(`  ✓ ${escritos} alimentos.`);
  }

  const publicos = await prisma.food.count({ where: { esPublico: true, deletedAt: null } });
  console.info(`\nListo: ${total} alimentos sembrados; ${publicos} públicos en la base.`);
}

main()
  .catch((error: unknown) => {
    console.error('\nLa siembra falló:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
