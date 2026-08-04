/**
 * @jest-environment node
 */
import type Stripe from 'stripe';

import { traducirEstado, traducirSuscripcion, userIdDeMetadata } from './sincronizacion';

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.STRIPE_PRICE_PRO_MENSUAL = 'price_pro_m';
  process.env.STRIPE_PRICE_CLINICA_MENSUAL = 'price_clinica';
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

/** Suscripción mínima de Stripe con lo único que lee la traducción. */
function suscripcion(parcial: Partial<Stripe.Subscription> = {}, priceId = 'price_pro_m') {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    metadata: {},
    items: {
      data: [
        {
          price: { id: priceId },
          // 2026-08-23T12:00:00Z
          current_period_end: 1_787_486_400,
        },
      ],
    },
    ...parcial,
  } as unknown as Stripe.Subscription;
}

describe('traducirEstado', () => {
  it('mantiene el acceso durante la prueba y el reintento de cobro', () => {
    expect(traducirEstado('trialing')).toBe('TRIALING');
    expect(traducirEstado('past_due')).toBe('PAST_DUE');
  });

  it('trata como no vigente lo que nunca llegó a cobrarse', () => {
    expect(traducirEstado('incomplete')).toBe('UNPAID');
    expect(traducirEstado('incomplete_expired')).toBe('CANCELED');
    expect(traducirEstado('paused')).toBe('CANCELED');
  });
});

describe('traducirSuscripcion', () => {
  it('deduce el plan del price id configurado', () => {
    expect(traducirSuscripcion(suscripcion())).toMatchObject({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      stripePriceId: 'price_pro_m',
      plan: 'PRO',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    });

    expect(traducirSuscripcion(suscripcion({}, 'price_clinica')).plan).toBe('CLINICA');
  });

  it('lee el fin de periodo del item, no de la suscripción', () => {
    const estado = traducirSuscripcion(suscripcion());
    expect(estado.currentPeriodEnd?.toISOString()).toBe('2026-08-23T12:00:00.000Z');
  });

  it('sin fin de periodo en el item lo deja nulo en vez de inventar una fecha', () => {
    const sub = suscripcion();
    // @ts-expect-error se fabrica el caso degenerado a propósito.
    sub.items.data[0].current_period_end = undefined;
    expect(traducirSuscripcion(sub).currentPeriodEnd).toBeNull();
  });

  it('conserva Pro para auditoría aunque el estado retire el acceso', () => {
    expect(traducirSuscripcion(suscripcion({ status: 'canceled' }))).toMatchObject({
      plan: 'PRO',
      status: 'CANCELED',
    });
    expect(traducirSuscripcion(suscripcion({ status: 'unpaid' })).plan).toBe('PRO');
  });

  it('un precio desconocido y activo no degrada a quien sí está pagando', () => {
    const estado = traducirSuscripcion(suscripcion({}, 'price_de_una_campaña'));
    expect(estado.plan).toBe('PRO');
    expect(estado.stripePriceId).toBe('price_de_una_campaña');
  });

  it('acepta el customer expandido igual que el id suelto', () => {
    const estado = traducirSuscripcion(
      suscripcion({ customer: { id: 'cus_exp' } as Stripe.Customer }),
    );
    expect(estado.stripeCustomerId).toBe('cus_exp');
  });

  it('propaga la cancelación programada al fin del periodo', () => {
    expect(traducirSuscripcion(suscripcion({ cancel_at_period_end: true }))).toMatchObject({
      status: 'ACTIVE',
      cancelAtPeriodEnd: true,
    });
  });
});

describe('userIdDeMetadata', () => {
  it('lee el identificador que se sembró en el checkout', () => {
    expect(userIdDeMetadata({ user_id: 'u-1' })).toBe('u-1');
  });

  it('ignora metadata ausente o vacía', () => {
    expect(userIdDeMetadata(null)).toBeUndefined();
    expect(userIdDeMetadata({ user_id: '  ' })).toBeUndefined();
    expect(userIdDeMetadata({})).toBeUndefined();
  });
});
