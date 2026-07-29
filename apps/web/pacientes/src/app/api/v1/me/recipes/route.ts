import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonList } from '@/server/http';
import { logger } from '@/server/logger';
import { recetasEnviadas } from '@/server/me/repository';
import { serializarReceta } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me/recipes — solo las recetas que el nutriólogo envió. */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const recetas = await recetasEnviadas(sesion.patientId);
    return jsonList(recetas.map(serializarReceta), {
      page: 1,
      per_page: recetas.length,
      total: recetas.length,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de recetas del paciente', error);
    return internalError();
  }
}
