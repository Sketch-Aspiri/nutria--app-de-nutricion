import { requiereNutriologo } from '@/server/auth/guards';
import { iaConfigurada } from '@/server/ai/cliente';
import { consultarCuota } from '@/server/ai/uso';
import { internalError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';

/**
 * `GET /api/v1/ai/usage` — cuota de IA del mes en curso.
 *
 * La UI la usa para mostrar cuántas generaciones quedan y para ofrecer el
 * upgrade antes de que el nutriólogo choque con el límite a mitad de un plan.
 */

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const cuota = await consultarCuota(sesion.userId);
    return jsonOk({ ...cuota, configurada: iaConfigurada() });
  } catch (error: unknown) {
    logger.error('No se pudo consultar la cuota de IA', error);
    return internalError();
  }
}
