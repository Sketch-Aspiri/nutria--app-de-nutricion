import { iaConfigurada } from '@/server/ai/cliente';
import { coachSchema } from '@/server/ai/schemasPaciente';
import { responderCoach } from '@/server/ai/servicioPaciente';
import { requierePaciente } from '@/server/auth/guards';
import { ErrorCode, jsonError, jsonOk, readJson, validationError } from '@/server/http';
import { errorDeIaPaciente } from '@/server/me/iaHttp';
import { limiteDeIa } from '@/server/me/limites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/ai/coach — el coach conversacional del paciente.
 *
 * Responde dudas y deriva a la nutrióloga; **no escribe nada**: ni el plan, ni
 * el expediente, ni la conversación. El historial lo conserva el cliente y
 * viaja en el cuerpo (§8 del plan).
 */
export async function POST(request: Request) {
  const sesion = await requierePaciente();
  if (!sesion.ok) return sesion.respuesta;

  if (!iaConfigurada()) {
    return jsonError(503, ErrorCode.AI_NOT_CONFIGURED, 'El asistente no está disponible.');
  }

  const limite = await limiteDeIa(sesion.userId);
  if (!limite.permitido) return limite.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = coachSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonOk(await responderCoach(sesion.patientId, sesion.userId, parsed.data));
  } catch (error: unknown) {
    return errorDeIaPaciente(error);
  }
}
