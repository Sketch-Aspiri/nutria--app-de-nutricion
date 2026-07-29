import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';
import { resumenDeHoy } from '@/server/me/repository';
import { serializarHoy } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/me/today — todo lo que pinta la pantalla Hoy.
 *
 * Una sola llamada en vez de cinco: plan del día, comidas marcadas, registros
 * libres, agua y adherencia se resuelven juntos en el servidor.
 */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    return jsonOk(serializarHoy(await resumenDeHoy(sesion.patientId)));
  } catch (error: unknown) {
    logger.error('Falló el resumen del día del paciente', error);
    return internalError();
  }
}
