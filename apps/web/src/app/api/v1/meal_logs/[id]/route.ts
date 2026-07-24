import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { comentarComida } from '@/server/tracking/repository';
import { comentarComidaSchema } from '@/server/tracking/schemas';
import { serializarComida } from '@/server/tracking/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/**
 * PATCH /api/v1/meal_logs/{id} — el nutriólogo comenta la comida.
 *
 * Solo se acepta su comentario: el registro del paciente (nombre, foto, su
 * propio comentario) es suyo y el profesional no lo reescribe.
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = comentarComidaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const resultado = await comentarComida(sesion.userId, id, parsed.data);
    if (!resultado) return notFound('No se encontró el registro de comida.');
    return jsonOk(serializarComida(resultado.comida, resultado.zonaHoraria));
  } catch (error: unknown) {
    logger.error('Falló el comentario sobre la comida registrada', error);
    return internalError();
  }
}
