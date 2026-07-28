import { requiereNutriologo } from '@/server/auth/guards';
import { FacturacionNoDisponibleError, crearSesionPortal } from '@/server/billing/servicio';
import { StripeNoConfiguradoError } from '@/server/billing/stripe';
import { ErrorCode, internalError, jsonError, jsonOk } from '@/server/http';
import { logger } from '@/server/logger';

/**
 * `POST /api/v1/billing/portal` — abre el Customer Portal de Stripe.
 *
 * Cambiar de plan, actualizar la tarjeta y cancelar ocurren allá: la app no
 * tiene —ni quiere tener— UI propia de medios de pago.
 */

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const sesion = await requiereNutriologo();
  if (!sesion.ok) return sesion.respuesta;

  try {
    const url = await crearSesionPortal(sesion.userId);
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
    logger.error('Falló la apertura del portal de facturación', error);
    return internalError();
  }
}
