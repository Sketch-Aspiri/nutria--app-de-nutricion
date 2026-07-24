import { requiereNutriologo } from '@/server/auth/guards';
import { internalError, jsonList } from '@/server/http';
import { logger } from '@/server/logger';
import { listarConversaciones } from '@/server/messages/repository';
import { serializarConversacion } from '@/server/messages/serializers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/conversations — bandeja del nutriólogo.
 *
 * Es la consulta que sondea la UI cada 30 s, así que devuelve solo el resumen
 * de cada hilo: última línea y pendientes, no los mensajes.
 */
export async function GET() {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const conversaciones = await listarConversaciones(sesion.userId);
    return jsonList(conversaciones.map(serializarConversacion), {
      page: 1,
      per_page: conversaciones.length,
      total: conversaciones.length,
    });
  } catch (error: unknown) {
    logger.error('Falló el listado de conversaciones', error);
    return internalError();
  }
}
