import { requiereNutriologo } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  notFound,
  parsePagination,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { enviarMensaje, listarHilo } from '@/server/messages/repository';
import { enviarMensajeSchema, filtroMensajesSchema } from '@/server/messages/schemas';
import { serializarMensaje } from '@/server/messages/serializers';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** GET /api/v1/patients/{id}/messages — hilo, o solo lo nuevo con ?desde_id=. */
export async function GET(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const filtros = filtroMensajesSchema.safeParse({
    desde_id: searchParams.get('desde_id') ?? undefined,
  });
  if (!filtros.success) return validationError(filtros.error);

  const { page, perPage, skip, take } = parsePagination(searchParams);
  try {
    const resultado = await listarHilo(sesion.userId, id, { skip, take }, filtros.data);
    if (!resultado) return notFound('No se encontró el paciente.');

    return jsonList(resultado.mensajes.map(serializarMensaje), {
      page,
      per_page: perPage,
      total: resultado.total,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de mensajes', error);
    return internalError();
  }
}

/** POST /api/v1/patients/{id}/messages — el nutriólogo escribe al paciente. */
export async function POST(request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = enviarMensajeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const mensaje = await enviarMensaje(sesion.userId, id, parsed.data);
    if (!mensaje) return notFound('No se encontró el paciente.');
    return jsonCreated(serializarMensaje(mensaje));
  } catch (error: unknown) {
    logger.error('Falló el envío del mensaje', error);
    return internalError();
  }
}
