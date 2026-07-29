import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonList } from '@/server/http';
import { logger } from '@/server/logger';
import { proximasCitas } from '@/server/me/repository';
import { serializarCita } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

const CITAS_MAX = 20;

/**
 * GET /api/v1/me/appointments — próximas citas programadas.
 *
 * Solo lectura en V1: el paciente no agenda ni cancela desde la app. No
 * incluye las notas de la cita, que son del nutriólogo.
 */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const citas = await proximasCitas(sesion.patientId, CITAS_MAX);
    return jsonList(citas.map(serializarCita), {
      page: 1,
      per_page: citas.length,
      total: citas.length,
    });
  } catch (error: unknown) {
    logger.error('Falló la lectura de citas del paciente', error);
    return internalError();
  }
}
