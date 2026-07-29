import { iaConfigurada } from '@/server/ai/cliente';
import { sustitucionSchema } from '@/server/ai/schemasPaciente';
import { sustituirIngrediente } from '@/server/ai/servicioPaciente';
import { requierePaciente } from '@/server/auth/guards';
import { ErrorCode, jsonError, jsonOk, readJson, validationError } from '@/server/http';
import { errorDeIaPaciente } from '@/server/me/iaHttp';
import { limiteDeIa } from '@/server/me/limites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/me/ai/substitution — cambia un ingrediente por otro equivalente.
 *
 * Con `receta_id` toma la receta como contexto, siempre que sea del paciente y
 * su nutrióloga se la haya enviado. La salida se rechaza si menciona un
 * alérgeno declarado: la comprobación no se le confía al prompt.
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

  const parsed = sustitucionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    return jsonOk(await sustituirIngrediente(sesion.patientId, sesion.userId, parsed.data));
  } catch (error: unknown) {
    return errorDeIaPaciente(error);
  }
}
