import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonNoContent, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { borrarComida } from '@/server/me/repository';

export const dynamic = 'force-dynamic';

type Contexto = { params: Promise<{ id: string }> };

/** DELETE /api/v1/me/meal_logs/{id} — desmarca o borra un registro propio. */
export async function DELETE(_request: Request, { params }: Contexto) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const { id } = await params;

  try {
    // La pertenencia va en el `where` del delete, no en una lectura previa.
    const borrado = await borrarComida(sesion.patientId, id);
    if (!borrado) return notFound('No se encontró ese registro.');
    return jsonNoContent();
  } catch (error: unknown) {
    logger.error('Falló el borrado de un registro de comida del paciente', error);
    return internalError();
  }
}
