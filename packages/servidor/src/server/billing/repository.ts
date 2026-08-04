import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

import { calcularEstadoCuenta, calcularExpiracionInicial } from '@nutria/shared';

import { prisma } from '@/server/db';

/**
 * Escrituras sobre `subscriptions`. El webhook de Stripe y la activación manual
 * del superadmin son las dos escrituras sancionadas. La segunda siempre queda
 * auditada con `lastActivatedAt` y `lastActivatedByUserId`.
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

async function expiracionInicialDelUsuario(userId: string): Promise<Date> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (!usuario) throw new Error(`No existe el usuario de la suscripción: ${userId}`);
  return calcularExpiracionInicial(usuario.createdAt);
}

/** Garantiza que el usuario tenga fila. El alta ya la crea; esto cubre el resto. */
export async function asegurarSuscripcion(userId: string) {
  const accessExpiresAt = await expiracionInicialDelUsuario(userId);
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan: 'PRO', accessExpiresAt },
    update: {},
  });
}

export async function guardarCustomerId(userId: string, stripeCustomerId: string) {
  await asegurarSuscripcion(userId);
  return prisma.subscription.update({
    where: { userId },
    data: { stripeCustomerId },
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
  await asegurarSuscripcion(userId);

  return prisma.$transaction(async (tx) => {
    // Serializa esta decisión con la activación manual. La lectura debe ocurrir
    // después del lock para que un webhook nunca calcule sobre una vigencia vieja.
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "subscriptions" WHERE "user_id" = ${userId}::uuid FOR UPDATE
    `;
    const existente = await tx.subscription.findUniqueOrThrow({ where: { userId } });
    const expiracionStripe = estado.currentPeriodEnd;
    const conservaAccesoLocal =
      calcularEstadoCuenta(existente.accessExpiresAt) === 'ACTIVA' &&
      (!expiracionStripe || existente.accessExpiresAt.getTime() > expiracionStripe.getTime());
    const accessExpiresAt = conservaAccesoLocal
      ? existente.accessExpiresAt
      : (expiracionStripe ?? existente.accessExpiresAt);
    const estadoBloqueante = estado.status === 'CANCELED' || estado.status === 'UNPAID';

    return tx.subscription.update({
      where: { userId },
      data: {
        ...estado,
        plan: conservaAccesoLocal ? existente.plan : estado.plan,
        status:
          estadoBloqueante && calcularEstadoCuenta(accessExpiresAt) === 'ACTIVA'
            ? 'ACTIVE'
            : estado.status,
        accessExpiresAt,
      },
    });
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
