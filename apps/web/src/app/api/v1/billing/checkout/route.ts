import { requiereNutriologo } from '@/server/auth/guards';
import { checkoutSchema } from '@/server/billing/schemas';
import { FacturacionNoDisponibleError, crearSesionCheckout } from '@/server/billing/servicio';
import { StripeNoConfiguradoError } from '@/server/billing/stripe';
import {
  ErrorCode,
  internalError,
  jsonError,
  jsonOk,
  readJson,
  validationError,
} from '@/server/http';
import { logger } from '@/server/logger';

/**
 * `POST /api/v1/billing/checkout` — abre Stripe Checkout en modo suscripción.
 *
 * Devuelve la URL en lugar de redirigir: la llamada sale de un `fetch` del
 * panel, y un 303 desde ahí lo seguiría el propio `fetch` en vez del navegador.
 */

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  const body = await readJson(request);
  if (body === null) {
    return jsonError(400, ErrorCode.INVALID_BODY, 'El cuerpo de la petición no es JSON válido.');
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const url = await crearSesionCheckout({
      userId: sesion.userId,
      plan: parsed.data.plan,
      periodo: parsed.data.periodo,
    });
    return jsonOk({ url });
  } catch (error: unknown) {
    if (error instanceof FacturacionNoDisponibleError) {
      return jsonError(409, ErrorCode.BILLING_NOT_AVAILABLE, error.message);
    }
    if (error instanceof StripeNoConfiguradoError) {
      return jsonError(
        503,
        ErrorCode.BILLING_NOT_CONFIGURED,
        'Los pagos no están configurados en este servidor.',
      );
    }
    logger.error('Falló la creación de la sesión de checkout', error);
    return internalError();
  }
}
