import { requiereNutriologo } from '@/server/auth/guards';
import {
  actualizarAlimentoPropio,
  archivarAlimentoPropio,
  buscarAlimento,
} from '@/server/foods/repository';
import { actualizarAlimentoSchema } from '@/server/foods/schemas';
import { serializarAlimento } from '@/server/foods/serializers';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonNoContent,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** No se distingue "no existe" de "es de otro nutriólogo". */
const NO_ENCONTRADO = 'No se encontró el alimento.';

/** GET /api/v1/foods/{id} — ficha completa. */
export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const alimento = await buscarAlimento(sesion.userId, id);
    if (!alimento) return notFound(NO_ENCONTRADO);
    return jsonOk(serializarAlimento(alimento, sesion.userId));
  } catch (error: unknown) {
    logger.error('Falló la lectura del alimento', error);
    return internalError();
  }
}

/**
 * PATCH /api/v1/foods/{id} — edición de un alimento propio.
 *
 * El catálogo público no se edita desde aquí: sus valores están citados por
 * planes de todos los nutriólogos.
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = actualizarAlimentoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const alimento = await actualizarAlimentoPropio(sesion.userId, id, parsed.data);
    if (!alimento) return notFound(NO_ENCONTRADO);
    return jsonOk(serializarAlimento(alimento, sesion.userId));
  } catch (error: unknown) {
    logger.error('Falló la edición del alimento', error);
    return internalError();
  }
}

/** DELETE /api/v1/foods/{id} — baja lógica de un alimento propio. */
export async function DELETE(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;

  try {
    const archivado = await archivarAlimentoPropio(sesion.userId, id);
    if (!archivado) return notFound(NO_ENCONTRADO);
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló el archivado del alimento', error);
    return internalError();
  }
}
