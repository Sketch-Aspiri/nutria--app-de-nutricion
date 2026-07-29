import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';
import { planVigente } from '@/server/me/repository';
import { serializarPlan } from '@/server/plans/serializers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/meal_plan — plan vigente del paciente.
 *
 * Devuelve `null` en vez de 404 cuando no hay plan compartido: no tenerlo es un
 * estado normal de la app ("tu nutriólogo aún no comparte tu plan"), no un error.
 */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const plan = await planVigente(sesion.patientId);
    return jsonOk(plan ? serializarPlan(plan) : null);
  } catch (error: unknown) {
    logger.error('Falló la lectura del plan del paciente', error);
    return internalError();
  }
}
