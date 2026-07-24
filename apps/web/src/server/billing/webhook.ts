import type Stripe from 'stripe';

import { logger } from '@/server/logger';

import {
  aplicarEstadoStripe,
  olvidarEventoStripe,
  registrarEventoStripe,
  usuarioDeCustomer,
} from './repository';
import { traducirSuscripcion, userIdDeMetadata } from './sincronizacion';
import { stripe } from './stripe';

/**
 * Procesamiento de los eventos de Stripe (punto 4 de la sección 9).
 *
 * El webhook es la **única** fuente de verdad del plan: ningún handler del panel
 * escribe `subscriptions.plan`. Todos los eventos que nos importan terminan en
 * lo mismo —releer la suscripción y volcarla—, así que en vez de mantener cinco
 * traducciones distintas se resuelve el objeto `Subscription` y se sincroniza.
 */

export const EVENTOS_ATENDIDOS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export type ResultadoWebhook =
  | { estado: 'procesado' }
  | { estado: 'repetido' }
  | { estado: 'ignorado'; motivo: string };

/**
 * Extrae el id de la suscripción afectada según el tipo de evento. Un evento
 * sin suscripción (por ejemplo, una factura suelta) no tiene nada que hacer.
 */
function idDeSuscripcion(evento: Stripe.Event): string | null {
  // El objeto del evento es una unión de ~70 recursos de Stripe; se inspecciona
  // por forma porque el tipo concreto ya lo determinó `evento.type`.
  const objeto = evento.data.object as unknown as Record<string, unknown>;

  if (evento.type.startsWith('customer.subscription.')) {
    return typeof objeto.id === 'string' ? objeto.id : null;
  }

  // Tanto la sesión de checkout como la factura traen `subscription`, que puede
  // llegar como id o ya expandido.
  const suscripcion = objeto.subscription ?? (objeto as { parent?: unknown }).parent;
  if (typeof suscripcion === 'string') return suscripcion;
  if (suscripcion && typeof suscripcion === 'object' && 'id' in suscripcion) {
    const id = (suscripcion as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

async function resolverUserId(sub: Stripe.Subscription, evento: Stripe.Event): Promise<string | null> {
  const deLaSuscripcion = userIdDeMetadata(sub.metadata);
  if (deLaSuscripcion) return deLaSuscripcion;

  const deLaSesion = userIdDeMetadata(
    (evento.data.object as { metadata?: Stripe.Metadata }).metadata,
  );
  if (deLaSesion) return deLaSesion;

  // Último recurso: el customer ya quedó ligado al crear la sesión de checkout.
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  return usuarioDeCustomer(customerId);
}

/**
 * Procesa un evento ya verificado. Idempotente: el registro del `event.id` es
 * lo primero que ocurre, y si ya existía el evento se descarta sin trabajar.
 */
export async function procesarEvento(evento: Stripe.Event): Promise<ResultadoWebhook> {
  const primeraVez = await registrarEventoStripe(evento.id, evento.type);
  if (!primeraVez) return { estado: 'repetido' };

  try {
    return await aplicarEvento(evento);
  } catch (error: unknown) {
    // La marca se pone *antes* de trabajar para ganarle a la doble entrega; si
    // el trabajo falla hay que quitarla, o el reintento de Stripe se
    // descartaría por "ya procesado" y el plan quedaría desincronizado.
    await olvidarEventoStripe(evento.id);
    throw error;
  }
}

async function aplicarEvento(evento: Stripe.Event): Promise<ResultadoWebhook> {
  if (!EVENTOS_ATENDIDOS.includes(evento.type as (typeof EVENTOS_ATENDIDOS)[number])) {
    return { estado: 'ignorado', motivo: 'tipo no atendido' };
  }

  const subId = idDeSuscripcion(evento);
  if (!subId) return { estado: 'ignorado', motivo: 'evento sin suscripción' };

  const sub = await stripe().subscriptions.retrieve(subId);
  const userId = await resolverUserId(sub, evento);
  if (!userId) {
    // Pasa si alguien crea la suscripción a mano en el panel de Stripe con un
    // customer que la app no conoce. Se registra y se responde 200: reintentarlo
    // no lo va a arreglar y Stripe seguiría golpeando el endpoint durante días.
    logger.warn('Evento de Stripe sin usuario asociado', {
      operation: 'billing.webhook',
      provider: 'stripe',
      code: evento.type,
    });
    return { estado: 'ignorado', motivo: 'sin usuario asociado' };
  }

  await aplicarEstadoStripe(userId, traducirSuscripcion(sub));
  logger.info('Suscripción sincronizada desde Stripe', {
    operation: 'billing.webhook',
    provider: 'stripe',
    code: evento.type,
  });
  return { estado: 'procesado' };
}
