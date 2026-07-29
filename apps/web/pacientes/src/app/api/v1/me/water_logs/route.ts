import { requierePaciente } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { guardarAgua } from '@/server/me/repository';
import { guardarAguaSchema } from '@/server/me/schemas';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/v1/me/water_logs — vasos del día.
 *
 * PUT y no POST porque es idempotente: la app manda el total del día, no un
 * incremento. Un "+1" se perdería o se duplicaría con reintentos de red.
 */
export async function PUT(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = guardarAguaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const registro = await guardarAgua(sesion.patientId, parsed.data);
    return jsonOk({
      fecha: registro.fecha.toISOString().slice(0, 10),
      vasos: registro.vasos,
      updated_at: registro.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Falló el registro de agua del paciente', error);
    return internalError();
  }
}
