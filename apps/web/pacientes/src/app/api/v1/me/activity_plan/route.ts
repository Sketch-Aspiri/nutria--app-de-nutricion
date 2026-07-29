import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';
import { planActividadCompartido } from '@/server/me/repository';
import { serializarPlanActividad } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me/activity_plan — solo si tiene `compartido_at`. */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const plan = await planActividadCompartido(sesion.patientId);
    return jsonOk(plan ? serializarPlanActividad(plan) : null);
  } catch (error: unknown) {
    logger.error('Falló la lectura del plan de actividad del paciente', error);
    return internalError();
  }
}
