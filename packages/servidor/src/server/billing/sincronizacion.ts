import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import type Stripe from 'stripe';

import { planDelPriceId } from './config';
import type { EstadoStripe } from './repository';

/**
 * Traducción de una suscripción de Stripe al estado que guarda la base.
 *
 * Es una función pura y vive aparte del handler del webhook para poder probarla
 * con objetos de Stripe fabricados a mano, sin red ni base de datos.
 */

/**
 * `incomplete` es el pago inicial que nunca se completó y `paused` es una
 * suscripción sin cobro: ninguna de las dos debe dar acceso, así que se mapean
 * a estados no vigentes en lugar de inventarles uno nuevo.
 */
const ESTADOS: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  incomplete: 'UNPAID',
  incomplete_expired: 'CANCELED',
  paused: 'CANCELED',
};

export function traducirEstado(estado: Stripe.Subscription.Status): SubscriptionStatus {
  return ESTADOS[estado] ?? 'CANCELED';
}

function idDePrecio(item: Stripe.SubscriptionItem | undefined): string | null {
  if (!item) return null;
  return typeof item.price === 'string' ? item.price : (item.price?.id ?? null);
}

/**
 * Fin del periodo pagado.
 *
 * Desde la versión de API que usa este SDK, `current_period_end` ya no está en
 * la suscripción sino en cada item. Se toma la del primer item: nuestras
 * suscripciones tienen uno solo, y si algún día tuvieran más, todos comparten
 * ciclo de facturación.
 */
function finDePeriodo(sub: Stripe.Subscription): Date | null {
  const segundos = sub.items?.data?.[0]?.current_period_end;
  return typeof segundos === 'number' ? new Date(segundos * 1000) : null;
}

export function traducirSuscripcion(sub: Stripe.Subscription): EstadoStripe {
  const item = sub.items?.data?.[0];
  const priceId = idDePrecio(item);
  const status = traducirEstado(sub.status);

  // Un precio que no reconocemos (creado a mano en el panel de Stripe, o de una
  // campaña) no puede degradar a alguien que sí está pagando: se asume Pro, el
  // plan de pago base, y queda el `stripe_price_id` para diagnosticarlo.
  const planDelPrecio = planDelPriceId(priceId);
  const plan: SubscriptionPlan = planDelPrecio ?? 'PRO';

  return {
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    // El plan contratado se conserva para auditoría. El estado y la expiración
    // deciden el acceso; `FREE` queda en el enum solo por compatibilidad.
    plan,
    status,
    currentPeriodEnd: finDePeriodo(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
  };
}

/** El `user_id` viaja en la metadata desde que se crea la sesión de checkout. */
export function userIdDeMetadata(metadata: Stripe.Metadata | null | undefined): string | undefined {
  const valor = metadata?.user_id?.trim();
  return valor ? valor : undefined;
}
