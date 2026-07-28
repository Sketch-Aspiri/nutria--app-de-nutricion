import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';

import { normalizarNombre } from '@nutria/shared';

/**
 * Subida por lotes de las imágenes del catálogo a Vercel Blob.
 *
 *   BLOB_READ_WRITE_TOKEN=... npm run db:imagenes
 *
 * Fuentes y licencias (sección 5 del plan): Open Food Facts (ODbL, con
 * atribución) para empaquetados y Wikimedia Commons (CC) para alimentos
 * frescos. No se descarga nada de un buscador de imágenes: sin licencia
 * verificable, el alimento se queda sin foto y la UI muestra el respaldo del
 * grupo, que es preferible a una foto que no podemos usar.
 *
 * El script es idempotente: solo toca los alimentos que aún no tienen
 * `imagen_url`, así que correrlo de nuevo únicamente completa lo que falte.
 */

const prisma = new PrismaClient();

/** Cuántos alimentos se procesan por corrida; el resto queda para la siguiente. */
const LOTE = 50;

/** Tamaños que pide la UI: miniatura de lista y ficha. */
const ANCHO_MINIATURA = 96;

type Candidata = {
  url: string;
  atribucion: string;
};

/**
 * Busca una foto con licencia abierta para el alimento.
 *
 * Open Food Facts responde por nombre y devuelve la imagen del producto junto
 * con su atribución. Si no hay coincidencia clara se regresa `null`: es mejor
 * el ícono del grupo que la foto de otro alimento.
 */
async function buscarImagen(nombre: string): Promise<Candidata | null> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', nombre);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', '5');
  url.searchParams.set('fields', 'product_name,image_front_url,brands');

  const respuesta = await fetch(url, {
    headers: { 'User-Agent': 'nutria/1.0 (seed de imágenes de alimentos)' },
  });
  if (!respuesta.ok) return null;

  const cuerpo = (await respuesta.json()) as {
    products?: { product_name?: string; image_front_url?: string }[];
  };

  const buscado = normalizarNombre(nombre);
  const producto = cuerpo.products?.find((candidato) => {
    if (!candidato.image_front_url || !candidato.product_name) return false;
    const suyo = normalizarNombre(candidato.product_name);
    return suyo.includes(buscado) || buscado.includes(suyo);
  });

  if (!producto?.image_front_url) return null;

  return {
    url: producto.image_front_url,
    atribucion: 'Open Food Facts (ODbL)',
  };
}

async function main(): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'Falta BLOB_READ_WRITE_TOKEN. Se obtiene en el proyecto de Vercel: Storage > Blob > Tokens.',
    );
  }

  const pendientes = await prisma.food.findMany({
    where: { imagenUrl: null, deletedAt: null, esPublico: true },
    orderBy: { nombre: 'asc' },
    take: LOTE,
    select: { id: true, nombre: true },
  });

  console.info(`${pendientes.length} alimentos sin imagen en este lote.\n`);

  let subidas = 0;
  for (const alimento of pendientes) {
    const candidata = await buscarImagen(alimento.nombre);
    if (!candidata) {
      console.info(`  —  ${alimento.nombre}: sin imagen con licencia verificable.`);
      continue;
    }

    const descarga = await fetch(candidata.url);
    if (!descarga.ok) {
      console.info(`  —  ${alimento.nombre}: la imagen no se pudo descargar.`);
      continue;
    }

    const contenido = await descarga.arrayBuffer();
    const tipo = descarga.headers.get('content-type') ?? 'image/jpeg';
    const ruta = `alimentos/${normalizarNombre(alimento.nombre).replace(/ /g, '-')}-${ANCHO_MINIATURA}`;

    const guardada = await put(ruta, contenido, {
      access: 'public',
      contentType: tipo,
      token,
    });

    await prisma.food.update({
      where: { id: alimento.id },
      data: { imagenUrl: guardada.url },
    });

    subidas += 1;
    console.info(`  ✓  ${alimento.nombre} — ${candidata.atribucion}`);
  }

  const faltan = await prisma.food.count({
    where: { imagenUrl: null, deletedAt: null, esPublico: true },
  });

  console.info(`\n${subidas} imágenes subidas. Quedan ${faltan} alimentos sin foto.`);
}

main()
  .catch((error: unknown) => {
    console.error('\nLa subida falló:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
