import { requierePaciente } from '@/server/auth/guards';
import { internalError, jsonOk, notFound } from '@/server/http';
import { logger } from '@/server/logger';
import { perfilDe } from '@/server/me/repository';
import { serializarPerfil } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/** GET /api/v1/me — perfil del paciente y metas de su plan vigente. */
export async function GET() {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const perfil = await perfilDe(sesion.patientId);
    if (!perfil) return notFound('No se encontró tu expediente.');
    return jsonOk(serializarPerfil(perfil));
  } catch (error: unknown) {
    logger.error('Falló la lectura del perfil del paciente', error);
    return internalError();
  }
}
