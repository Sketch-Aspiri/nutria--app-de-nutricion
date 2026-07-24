import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

import { prisma } from '@/server/db';

/**
 * Escrituras sobre `subscriptions`. Solo el webhook de Stripe llama a
 * `aplicarEstadoStripe`: el plan de un usuario no se cambia desde un handler
 * del panel, porque entonces la verdad estaría en dos lugares.
 */

export type EstadoStripe = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** Garantiza que el usuario tenga fila. El alta ya la crea; esto cubre el resto. */
export async function asegurarSuscripcion(userId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function guardarCustomerId(userId: string, stripeCustomerId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, stripeCustomerId },
    update: { stripeCustomerId },
  });
}

/**
 * Vuelca a la base el estado que reporta Stripe.
 *
 * Se busca por `userId` y no por `stripe_customer_id` porque el customer puede
 * no estar todavía asociado (primera compra); el `userId` viaja en la metadata
 * de la sesión de checkout y de la suscripción.
 */
export async function aplicarEstadoStripe(userId: string, estado: EstadoStripe) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...estado },
    update: estado,
  });
}

/** Resuelve el dueño de un customer de Stripe cuando el evento no trae metadata. */
export async function usuarioDeCustomer(stripeCustomerId: string): Promise<string | null> {
  const fila = await prisma.subscription.findUnique({
    where: { stripeCustomerId },
    select: { userId: true },
  });
  return fila?.userId ?? null;
}

/**
 * Marca un evento como procesado. Devuelve `false` si ya estaba: es la pieza
 * que hace idempotente al webhook, y se apoya en la llave primaria en vez de en
 * un `findUnique` previo, que dejaría una carrera entre dos entregas paralelas.
 */
export async function registrarEventoStripe(id: string, tipo: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id, tipo } });
    return true;
  } catch (error: unknown) {
    if (esViolacionDeUnicidad(error)) return false;
    throw error;
  }
}

/**
 * Borra la marca de un evento cuyo procesamiento falló, para que el reintento
 * de Stripe no lo descarte por "ya procesado". Sin esto, la marca temprana que
 * evita la doble entrega convertiría cualquier fallo transitorio en un evento
 * perdido para siempre.
 */
export async function olvidarEventoStripe(id: string): Promise<void> {
  await prisma.stripeEvent.deleteMany({ where: { id } });
}

function esViolacionDeUnicidad(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
