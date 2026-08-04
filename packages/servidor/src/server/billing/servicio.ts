import type { PeriodoFacturacion, PlanSuscripcion } from '@nutria/shared';
import { planDelCatalogo } from '@nutria/shared';

import { prisma } from '@/server/db';
import { logger } from '@/server/logger';

import { priceIdDe, stripeCheckoutHabilitado, urlBase } from './config';
import { estadoSuscripcion } from './entitlements';
import { guardarCustomerId } from './repository';
import { stripe } from './stripe';

/**
 * Alta y gestión de la suscripción: Checkout y Customer Portal (puntos 2 y 3 de
 * la sección 9). La app no toca datos de tarjeta en ningún momento — todo el
 * flujo de pago ocurre en dominios de Stripe.
 */

export type MotivoNoDisponible = 'PAGOS_NO_CONFIGURADOS' | 'PLAN_SIN_PRECIO' | 'SIN_SUSCRIPCION';

export class FacturacionNoDisponibleError extends Error {
  constructor(
    readonly motivo: MotivoNoDisponible,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'FacturacionNoDisponibleError';
  }
}

/**
 * Devuelve el `customer` de Stripe del usuario, creándolo la primera vez.
 *
 * El correo se manda a Stripe porque es quien emite el recibo; el nombre del
 * nutriólogo también. Ningún dato clínico sale de aquí: la metadata lleva solo
 * el identificador interno, que es lo que el webhook necesita para volver.
 */
async function customerDelUsuario(userId: string): Promise<string> {
  const existente = await estadoSuscripcion(userId);
  if (existente.stripeCustomerId) return existente.stripeCustomerId;

  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!usuario) throw new Error(`Usuario inexistente al crear el customer: ${userId}`);

  const customer = await stripe().customers.create({
    email: usuario.email ?? undefined,
    name: usuario.name ?? undefined,
    metadata: { user_id: userId },
  });

  await guardarCustomerId(userId, customer.id);
  logger.info('Customer de Stripe creado', { operation: 'billing.customer', provider: 'stripe' });
  return customer.id;
}

export type PeticionCheckout = {
  userId: string;
  plan: PlanSuscripcion;
  periodo: PeriodoFacturacion;
};

/** Crea la sesión de Checkout y devuelve la URL a la que hay que redirigir. */
export async function crearSesionCheckout(peticion: PeticionCheckout): Promise<string> {
  if (!stripeCheckoutHabilitado()) {
    throw new FacturacionNoDisponibleError(
      'PAGOS_NO_CONFIGURADOS',
      'Los pagos en línea todavía no están disponibles; contáctanos para activar o renovar tu cuenta.',
    );
  }

  const priceId = priceIdDe(peticion.plan, peticion.periodo);
  if (!priceId) {
    throw new FacturacionNoDisponibleError(
      'PLAN_SIN_PRECIO',
      'Ese plan no está disponible para contratar en este momento.',
    );
  }

  const customer = await customerDelUsuario(peticion.userId);
  const diasPrueba = planDelCatalogo(peticion.plan).diasPrueba;
  const base = urlBase();

  const sesion = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    // El identificador va tanto en la sesión como en la suscripción que Stripe
    // creará: los eventos posteriores (`customer.subscription.updated`) solo
    // ven la suscripción, y sin esto habría que resolver el dueño por customer.
    metadata: { user_id: peticion.userId },
    subscription_data: {
      metadata: { user_id: peticion.userId },
      ...(diasPrueba > 0 ? { trial_period_days: diasPrueba } : {}),
    },
    // Stripe Tax calcula el IVA mexicano; sin esto los precios irían sin impuesto.
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto' },
    allow_promotion_codes: true,
    success_url: `${base}/suscripcion?checkout=exito`,
    cancel_url: `${base}/suscripcion?checkout=cancelado`,
  });

  if (!sesion.url) throw new Error('Stripe devolvió una sesión de checkout sin URL.');
  return sesion.url;
}

/** Abre el Customer Portal: cambio de plan, tarjeta y cancelación viven ahí. */
export async function crearSesionPortal(userId: string): Promise<string> {
  if (!stripeCheckoutHabilitado()) {
    throw new FacturacionNoDisponibleError(
      'PAGOS_NO_CONFIGURADOS',
      'Los pagos en línea todavía no están disponibles; contáctanos para activar o renovar tu cuenta.',
    );
  }

  const estado = await estadoSuscripcion(userId);
  if (!estado.stripeCustomerId) {
    throw new FacturacionNoDisponibleError(
      'SIN_SUSCRIPCION',
      'Todavía no tienes una suscripción de pago que gestionar.',
    );
  }

  const sesion = await stripe().billingPortal.sessions.create({
    customer: estado.stripeCustomerId,
    return_url: `${urlBase()}/suscripcion`,
  });
  return sesion.url;
}
