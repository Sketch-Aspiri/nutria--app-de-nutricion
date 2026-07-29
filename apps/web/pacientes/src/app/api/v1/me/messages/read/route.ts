import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { marcarMensajesLeidos } from '@/server/me/repository';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/messages/read — marca como leídos los mensajes recibidos.
 *
 * Solo toca los del nutriólogo: marcar los propios no significa nada y
 * borraría la señal de "sin leer" que el panel usa del otro lado.
 */
export async function POST() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  try {
    return jsonOk({ marcados: await marcarMensajesLeidos(sesion.patientId) });
  } catch (error: unknown) {
    logger.error('Falló el marcado de mensajes leídos del paciente', error);
    return internalError();
  }
}
