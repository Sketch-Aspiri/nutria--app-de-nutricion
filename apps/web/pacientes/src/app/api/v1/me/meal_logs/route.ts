import { requierePaciente } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonCreated,
  jsonError,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';
import { limiteDeEscritura } from '@/server/me/limites';
import { registrarComida } from '@/server/me/repository';
import { registrarComidaSchema } from '@/server/me/schemas';
import { serializarRegistroComida } from '@/server/me/serializers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/meal_logs — marca una comida del plan o registra una libre.
 *
 * Con `meal_plan_meal_id` marca; sin él, anota una comida libre con sus macros.
 * El `patient_id` no se acepta del cliente: sale de la sesión.
 */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  const limite = await limiteDeEscritura(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = registrarComidaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const resultado = await registrarComida(sesion.patientId, parsed.data);
    // `null` significa que la comida del plan no es de este paciente. Se
    // responde 404 y no 403: distinguirlos revelaría qué ids existen.
    if (!resultado) {
      return jsonError(404, ErrorCode.NOT_FOUND, 'No se encontró esa comida en tu plan.');
    }

    return jsonCreated(serializarRegistroComida(resultado.comida, resultado.zonaHoraria));
  } catch (error: unknown) {
    logger.error('Falló el registro de comida del paciente', error);
    return internalError();
  }
}
