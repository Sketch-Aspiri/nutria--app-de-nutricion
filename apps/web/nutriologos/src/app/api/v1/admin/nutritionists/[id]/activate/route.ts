import {
  activarNutriologa,
  activarNutriologaSchema,
  NutriologaGestionadaPorStripeError,
  nutriologaIdSchema,
} from '@/server/admin/nutritionists';
import { requiereSuperAdmin } from '@/server/auth/guards';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  notFound,
  origenPermitido,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

export const runtime = 'nodejs';

type Contexto = { params: Promise<{ id: string }> };

export async function POST(request: Request, contexto: Contexto): Promise<Response> {
  const sesion = await requiereSuperAdmin();
  if (!sesion.ok) return sesion.respuesta;
  if (!origenPermitido(request)) {
    return jsonError(403, ErrorCode.FORBIDDEN, 'El origen de la petición no está permitido.');
  }

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = activarNutriologaSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const params = nutriologaIdSchema.safeParse(await contexto.params);
  if (!params.success) return validationError(params.error);

  try {
    const nutriologa = await activarNutriologa(
      params.data.id,
      sesion.userId,
      parsed.data.activation_note,
    );
    if (!nutriologa) return notFound('No se encontró la cuenta de nutrióloga.');
    const respuesta = jsonOk(nutriologa);
    respuesta.headers.set('Cache-Control', 'private, no-store');
    return respuesta;
  } catch (error: unknown) {
    if (error instanceof NutriologaGestionadaPorStripeError) {
      return jsonError(409, ErrorCode.BILLING_NOT_AVAILABLE, error.message);
    }
    logger.error('No se pudo activar la cuenta de la nutrióloga', error);
    return internalError();
  }
}
