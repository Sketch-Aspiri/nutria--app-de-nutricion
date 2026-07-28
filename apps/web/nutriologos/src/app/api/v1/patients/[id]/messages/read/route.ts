import { requiereNutriologo } from '@/server/auth/guards';
import { internalError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { marcarHiloLeido } from '@/server/messages/repository';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** POST /api/v1/patients/{id}/messages/read — marca leído lo que mandó el paciente. */
export async function POST(_request: Request, { params }: Contexto) {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const { id } = await params;
  try {
    const marcados = await marcarHiloLeido(sesion.userId, id);
    if (marcados === null) return notFound('No se encontró el paciente.');
    return jsonOk({ marcados });
  } catch (error: unknown) {
    logger.error('Falló el marcado de mensajes como leídos', error);
    return internalError();
  }
}
