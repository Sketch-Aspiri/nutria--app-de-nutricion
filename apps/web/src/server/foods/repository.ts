import { Prisma, type Food } from '@prisma/client';

import {
  equivalentesSugeridos,
  expandirBusqueda,
  type GrupoAlimento,
  normalizarNombre,
} from '@nutria/shared';

import { prisma } from '@/server/db';

import type { ActualizarAlimentoInput, AlimentoPropioInput, BusquedaInput } from './schemas';

/**
 * Acceso a la base de alimentos.
 *
 * Un nutriólogo ve el catálogo público más sus propios alimentos, y nada de lo
 * que capturaron otros: ese filtro va en la misma consulta, no después. Sus
 * alimentos aparecen primero, porque son los que él capturó para su consulta.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esIdValido(id: string): boolean {
  return UUID.test(id);
}

export type ResultadoBusqueda = { alimentos: Food[]; total: number };

export async function buscarAlimentos(
  nutritionistId: string,
  filtros: BusquedaInput & { skip: number; take: number },
): Promise<ResultadoBusqueda> {
  const consulta = filtros.query?.trim();

  if (!consulta) return listarAlimentos(nutritionistId, filtros);
  return buscarPorNombre(nutritionistId, consulta, filtros);
}

/** Sin texto de búsqueda: navegación por grupo, ordenada alfabéticamente. */
async function listarAlimentos(
  nutritionistId: string,
  filtros: BusquedaInput & { skip: number; take: number },
): Promise<ResultadoBusqueda> {
  const where = condiciones(nutritionistId, filtros);

  const [alimentos, total] = await Promise.all([
    prisma.food.findMany({
      where,
      orderBy: [{ nutritionistId: { sort: 'desc', nulls: 'last' } }, { nombre: 'asc' }],
      skip: filtros.skip,
      take: filtros.take,
    }),
    prisma.food.count({ where }),
  ]);

  return { alimentos, total };
}

function condiciones(
  nutritionistId: string,
  filtros: Pick<BusquedaInput, 'grupo' | 'solo_propios'>,
): Prisma.FoodWhereInput {
  return {
    deletedAt: null,
    ...(filtros.grupo ? { grupoSmae: filtros.grupo } : {}),
    ...(filtros.solo_propios
      ? { nutritionistId }
      : { OR: [{ esPublico: true, nutritionistId: null }, { nutritionistId }] }),
  };
}

/**
 * Búsqueda difusa contra el índice de trigramas.
 *
 * Va en SQL crudo porque Prisma no expone el operador `%` ni `similarity()`, y
 * sin ellos "jitomate" no encontraría "jitomates" ni "tomate rojo". Se traen
 * solo los identificadores y el orden; los renglones completos los lee Prisma,
 * que sí sabe mapear las columnas al modelo.
 */
async function buscarPorNombre(
  nutritionistId: string,
  consulta: string,
  filtros: BusquedaInput & { skip: number; take: number },
): Promise<ResultadoBusqueda> {
  const variantes = expandirBusqueda(consulta);
  if (variantes.length === 0) return { alimentos: [], total: 0 };

  const filtro = filtroSql(nutritionistId, consulta, variantes, filtros);

  const [ordenados, conteo] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM foods
      WHERE ${filtro}
      ORDER BY
        (nutritionist_id IS NOT NULL) DESC,
        ${puntaje(variantes)} DESC,
        nombre ASC
      LIMIT ${filtros.take} OFFSET ${filtros.skip}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM foods WHERE ${filtro}
    `,
  ]);

  const ids = ordenados.map((renglon) => renglon.id);
  if (ids.length === 0) return { alimentos: [], total: Number(conteo[0]?.total ?? 0) };

  // `IN` no conserva el orden del ranking: se reordena con el que ya se calculó.
  const alimentos = await prisma.food.findMany({ where: { id: { in: ids } } });
  const porId = new Map(alimentos.map((alimento) => [alimento.id, alimento]));

  return {
    alimentos: ids
      .map((id) => porId.get(id))
      .filter((alimento): alimento is Food => alimento !== undefined),
    total: Number(conteo[0]?.total ?? 0),
  };
}

/**
 * El mejor parecido entre la consulta y sus variantes por sinonimia.
 *
 * `similarity` compara los nombres completos y `word_similarity` compara la
 * consulta contra el mejor tramo del nombre. Hacen falta las dos: buscar
 * "pollo" tiene que encontrar "Pechuga de pollo sin piel, cocida", donde la
 * similitud de cadena completa se hunde por lo largo del nombre.
 */
function puntaje(variantes: string[]): Prisma.Sql {
  const similitudes = variantes.flatMap((variante) => [
    Prisma.sql`similarity(nombre_normalizado, ${variante})`,
    Prisma.sql`word_similarity(${variante}, nombre_normalizado)`,
  ]);
  return Prisma.sql`GREATEST(${Prisma.join(similitudes, ', ')})`;
}

function filtroSql(
  nutritionistId: string,
  consulta: string,
  variantes: string[],
  filtros: Pick<BusquedaInput, 'grupo' | 'solo_propios'>,
): Prisma.Sql {
  // `%` compara nombres completos y `<%` busca la consulta dentro del nombre;
  // ambos son operadores de trigramas y usan el índice GIN. El LIKE por prefijo
  // rescata las búsquedas de tres letras, donde el trigrama no discrimina.
  const coincidencias = variantes.flatMap((variante) => [
    Prisma.sql`nombre_normalizado % ${variante}`,
    Prisma.sql`${variante} <% nombre_normalizado`,
    Prisma.sql`nombre_normalizado LIKE ${`${variante}%`}`,
  ]);

  const visibilidad = filtros.solo_propios
    ? Prisma.sql`nutritionist_id = ${nutritionistId}::uuid`
    : Prisma.sql`((es_publico = true AND nutritionist_id IS NULL) OR nutritionist_id = ${nutritionistId}::uuid)`;

  const porGrupo = filtros.grupo
    ? Prisma.sql`AND grupo_smae = ${filtros.grupo}`
    : Prisma.empty;

  return Prisma.sql`
    deleted_at IS NULL
    AND ${visibilidad}
    ${porGrupo}
    AND (${Prisma.join(coincidencias, ' OR ')})
  `;
}

/** Un alimento público o propio; nunca el de otro nutriólogo. */
export async function buscarAlimento(
  nutritionistId: string,
  id: string,
): Promise<Food | null> {
  if (!esIdValido(id)) return null;

  return prisma.food.findFirst({
    where: {
      id,
      deletedAt: null,
      OR: [{ esPublico: true, nutritionistId: null }, { nutritionistId }],
    },
  });
}

export function crearAlimentoPropio(
  nutritionistId: string,
  datos: AlimentoPropioInput,
): Promise<Food> {
  return prisma.food.create({
    data: {
      ...camposComunes(datos),
      nombre: datos.nombre,
      nombreNormalizado: normalizarNombre(datos.nombre),
      grupoSmae: datos.grupo,
      porcionDescripcion: datos.porcion_descripcion,
      porcionGramos: datos.porcion_gramos,
      energiaKcal: datos.energia_kcal,
      proteinaG: datos.proteina_g,
      lipidosG: datos.lipidos_g,
      carbohidratosG: datos.carbohidratos_g,
      equivalentes:
        datos.equivalentes ??
        equivalentesSugeridos(datos.grupo as GrupoAlimento, datos.energia_kcal),
      fuente: 'PROPIA',
      // Un alimento capturado por un nutriólogo es suyo: no entra al catálogo
      // común, donde nadie revisó de dónde salieron esos valores.
      esPublico: false,
      nutritionist: { connect: { id: nutritionistId } },
    },
  });
}

/**
 * Solo se puede editar lo propio.
 *
 * La pertenencia va en el `where` del update: leer y comparar después dejaría
 * una ventana entre la lectura y la escritura.
 */
export async function actualizarAlimentoPropio(
  nutritionistId: string,
  id: string,
  datos: ActualizarAlimentoInput,
): Promise<Food | null> {
  if (!esIdValido(id)) return null;

  const resultado = await prisma.food.updateMany({
    where: { id, nutritionistId, deletedAt: null },
    data: {
      ...camposComunes(datos),
      ...(datos.nombre !== undefined
        ? { nombre: datos.nombre, nombreNormalizado: normalizarNombre(datos.nombre) }
        : {}),
      ...(datos.grupo !== undefined ? { grupoSmae: datos.grupo } : {}),
      ...(datos.porcion_descripcion !== undefined
        ? { porcionDescripcion: datos.porcion_descripcion }
        : {}),
      ...(datos.porcion_gramos !== undefined ? { porcionGramos: datos.porcion_gramos } : {}),
      ...(datos.energia_kcal !== undefined ? { energiaKcal: datos.energia_kcal } : {}),
      ...(datos.proteina_g !== undefined ? { proteinaG: datos.proteina_g } : {}),
      ...(datos.lipidos_g !== undefined ? { lipidosG: datos.lipidos_g } : {}),
      ...(datos.carbohidratos_g !== undefined
        ? { carbohidratosG: datos.carbohidratos_g }
        : {}),
      ...(datos.equivalentes !== undefined ? { equivalentes: datos.equivalentes } : {}),
    },
  });

  if (resultado.count === 0) return null;
  return prisma.food.findUnique({ where: { id } });
}

/**
 * Baja lógica: un alimento borrado puede seguir citado por planes ya
 * entregados, y el histórico del paciente no se reescribe.
 */
export async function archivarAlimentoPropio(
  nutritionistId: string,
  id: string,
): Promise<boolean> {
  if (!esIdValido(id)) return false;

  const resultado = await prisma.food.updateMany({
    where: { id, nutritionistId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return resultado.count > 0;
}

/** Campos que se copian igual en el alta y en la edición. */
function camposComunes(datos: ActualizarAlimentoInput) {
  return {
    ...(datos.subgrupo !== undefined ? { subgrupo: datos.subgrupo ?? null } : {}),
    ...(datos.saturadas_g !== undefined ? { saturadasG: datos.saturadas_g ?? null } : {}),
    ...(datos.colesterol_mg !== undefined ? { colesterolMg: datos.colesterol_mg ?? null } : {}),
    ...(datos.fibra_g !== undefined ? { fibraG: datos.fibra_g ?? null } : {}),
    ...(datos.azucar_g !== undefined ? { azucarG: datos.azucar_g ?? null } : {}),
    ...(datos.sodio_mg !== undefined ? { sodioMg: datos.sodio_mg ?? null } : {}),
    ...(datos.potasio_mg !== undefined ? { potasioMg: datos.potasio_mg ?? null } : {}),
    ...(datos.calcio_mg !== undefined ? { calcioMg: datos.calcio_mg ?? null } : {}),
    ...(datos.hierro_mg !== undefined ? { hierroMg: datos.hierro_mg ?? null } : {}),
    ...(datos.acido_folico_ug !== undefined
      ? { acidoFolicoUg: datos.acido_folico_ug ?? null }
      : {}),
    ...(datos.vitamina_a_ug !== undefined ? { vitaminaAUg: datos.vitamina_a_ug ?? null } : {}),
    ...(datos.vitamina_c_mg !== undefined ? { vitaminaCMg: datos.vitamina_c_mg ?? null } : {}),
    ...(datos.indice_glicemico !== undefined
      ? { indiceGlicemico: datos.indice_glicemico ?? null }
      : {}),
    ...(datos.imagen_url !== undefined ? { imagenUrl: datos.imagen_url ?? null } : {}),
  };
}

/** Cuántos alimentos hay por grupo, para las pestañas del buscador. */
export async function contarPorGrupo(
  nutritionistId: string,
): Promise<Record<string, number>> {
  const conteos = await prisma.food.groupBy({
    by: ['grupoSmae'],
    where: condiciones(nutritionistId, { solo_propios: false }),
    _count: { _all: true },
  });

  return Object.fromEntries(
    conteos.map((conteo) => [conteo.grupoSmae, conteo._count._all]),
  );
}
