import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';
import { resumenDeProgreso } from '@/server/me/repository';
import { serializarProgreso } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/progress — serie de peso, tendencia y logros.
 *
 * Los logros se **calculan** en `packages/shared` a partir de los registros
 * reales; no hay tabla que mantener sincronizada. `falta_kg` viaja en `null`
 * porque el modelo todavía no guarda un peso objetivo.
 */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    return jsonOk(serializarProgreso(await resumenDeProgreso(sesion.patientId)));
  } catch (error: unknown) {
    logger.error('Falló el resumen de progreso del paciente', error);
    return internalError();
  }
}
