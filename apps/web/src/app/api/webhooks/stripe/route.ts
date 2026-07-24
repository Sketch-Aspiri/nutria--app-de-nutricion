import type Stripe from 'stripe';

import { stripeWebhookSecret } from '@/server/billing/config';
import { stripe } from '@/server/billing/stripe';
import { procesarEvento } from '@/server/billing/webhook';
import { logger } from '@/server/logger';

/**
 * `POST /api/webhooks/stripe` — la única entrada que cambia el plan de un
 * usuario (punto 4 de la sección 9 del plan V2).
 *
 * Vive fuera de `/api/v1` a propósito: no es parte del contrato de la app, es
 * un endpoint máquina-a-máquina cuyo formato lo define Stripe. No lleva sesión
 * —quien llama es Stripe, no un navegador—; la autenticación es la firma
 * `stripe-signature`, verificada contra el cuerpo **crudo**. Por eso se lee con
 * `request.text()`: cualquier reserialización del JSON invalidaría la firma.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const secreto = stripeWebhookSecret();
  if (!secreto) {
    logger.error('Webhook de Stripe recibido sin STRIPE_WEBHOOK_SECRET configurado');
    return respuesta(503, 'webhook no configurado');
  }

  const firma = request.headers.get('stripe-signature');
  if (!firma) return respuesta(400, 'falta la firma');

  const cuerpo = await request.text();

  let evento: Stripe.Event;
  try {
    evento = await stripe().webhooks.constructEventAsync(cuerpo, firma, secreto);
  } catch (error: unknown) {
    // Firma inválida: o el secreto no corresponde al endpoint, o alguien está
    // inventando eventos. En ambos casos, 400 y nada de tocar la base.
    logger.warn('Firma de webhook de Stripe inválida', {
      operation: 'billing.webhook',
      provider: 'stripe',
    });
    return respuesta(400, 'firma inválida');
  }

  try {
    const resultado = await procesarEvento(evento);
    return respuesta(200, resultado.estado);
  } catch (error: unknown) {
    // 500 a propósito: Stripe reintenta con backoff durante días y el evento ya
    // quedó desmarcado, así que el reintento sí volverá a procesarlo.
    logger.error('Falló el procesamiento de un evento de Stripe', error);
    return respuesta(500, 'error al procesar');
  }
}

function respuesta(status: number, resultado: string): Response {
  return Response.json({ received: true, resultado }, { status });
}
