import { iaConfigurada } from '@/server/ai/cliente';
import { estimacionComidaSchema } from '@/server/ai/schemasPaciente';
import { estimarComida } from '@/server/ai/servicioPaciente';
import { requierePaciente } from '@/server/auth/guards';
import { ErrorCode, jsonError, jsonOk, readJson, validationError } from '@/server/http';
import { errorDeIaPaciente } from '@/server/me/iaHttp';
import { limiteDeIa } from '@/server/me/limites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/ai/meal_estimate — estima los macros de una comida descrita
 * en texto.
 *
 * Devuelve la estimación, **no la guarda**: es la app quien la registra con
 * `POST /me/meal_logs` y `origen = IA` si el paciente la confirma. Así una
 * alucinación del modelo no puede quedar en su diario sin que él la vea.
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

  const parsed = estimacionComidaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonOk(await estimarComida(sesion.patientId, sesion.userId, parsed.data));
  } catch (error: unknown) {
    return errorDeIaPaciente(error);
  }
}
