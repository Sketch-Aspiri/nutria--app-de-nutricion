import { requierePaciente } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  jsonList,
  notFound,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { contarMensajesSinLeer, enviarMensaje, listarMensajes } from '@/server/me/repository';
import { enviarMensajeSchema } from '@/server/me/schemas';
import { serializarMensaje } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** Tope del hilo: la app hace polling y no necesita el historial completo. */
const MENSAJES_MAX = 100;

/**
 * GET /api/v1/me/messages — hilo con el nutriólogo, del más reciente atrás.
 *
 * Incluye `sin_leer` para que la nav inferior pinte su indicador sin una
 * segunda petición.
 */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const [mensajes, sinLeer] = await Promise.all([
      listarMensajes(sesion.patientId, MENSAJES_MAX),
      contarMensajesSinLeer(sesion.patientId),
    ]);

    return jsonList(mensajes.map(serializarMensaje), {
      page: 1,
      per_page: mensajes.length,
      total: mensajes.length,
      sin_leer: sinLeer,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de mensajes del paciente', error);
    return internalError();
  }
}

/** POST /api/v1/me/messages — el destinatario sale del expediente, no del body. */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = enviarMensajeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const mensaje = await enviarMensaje(sesion.patientId, parsed.data.texto);
    if (!mensaje) return notFound('No se encontró tu expediente.');
    return jsonCreated(serializarMensaje(mensaje));
  } catch (error: unknown) {
    logger.error('Falló el envío de un mensaje del paciente', error);
    return internalError();
  }
}
