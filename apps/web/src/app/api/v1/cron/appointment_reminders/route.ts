import { enviarRecordatoriosPendientes } from '@/server/appointments/recordatorios';
import { verificarCron } from '@/server/cron';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';
// El envío es secuencial y acotado a 50 citas; el default de 10 s no alcanza.
export const maxDuration = 60;

/**
 * GET /api/v1/cron/appointment_reminders
 *
 * Vercel Cron la invoca cada 15 minutos (ver `vercel.json`). El resumen que
 * devuelve solo trae contadores: los correos y nombres de los pacientes no
 * salen en la respuesta ni en el log.
 */
export async function GET(request: Request) {
  const rechazo = verificarCron(request);
  if (rechazo) return rechazo;

  try {
    const resultado = await enviarRecordatoriosPendientes();
    logger.info('Recordatorios de cita procesados', {
      operation: 'recordatorio_cita',
      status: resultado.enviados,
    });
    return jsonOk(resultado);
  } catch (error: unknown) {
    logger.error('Falló la corrida de recordatorios de cita', error);
    return internalError();
  }
}
