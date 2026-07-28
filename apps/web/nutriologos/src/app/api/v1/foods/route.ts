import { requiereNutriologo } from '@/server/auth/guards';
import { buscarAlimentos, crearAlimentoPropio } from '@/server/foods/repository';
import { alimentoPropioSchema, leerFiltros } from '@/server/foods/schemas';
import { serializarAlimento } from '@/server/foods/serializers';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  parsePagination,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/foods — catálogo público + alimentos propios del nutriólogo.
 *
 * `query` busca por similitud (tolera acentos, plurales y sinónimos mexicanos),
 * `grupo` filtra por grupo de equivalentes y `solo_propios=true` deja fuera el
 * catálogo común.
 */
export async function GET(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { searchParams } = new URL(request.url);
  const filtros = leerFiltros(searchParams);
  if (!filtros.success) return validationError(filtros.error);

  const { page, perPage, skip, take } = parsePagination(searchParams);

  try {
    const { alimentos, total } = await buscarAlimentos(sesion.userId, {
      ...filtros.data,
      skip,
      take,
    });

    return jsonList(
      alimentos.map((alimento) => serializarAlimento(alimento, sesion.userId)),
      { page, per_page: perPage, total },
    );
  } catch (error: unknown) {
    logger.error('Falló la búsqueda de alimentos', error);
    return internalError();
  }
}

/** POST /api/v1/foods — alta de un alimento propio (receta, marca local). */
export async function POST(request: Request) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = alimentoPropioSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const alimento = await crearAlimentoPropio(sesion.userId, parsed.data);
    return jsonCreated(serializarAlimento(alimento, sesion.userId));
  } catch (error: unknown) {
    logger.error('Falló el alta de alimento propio', error);
    return internalError();
  }
}
