/**
 * @jest-environment node
 */
import type Stripe from 'stripe';

import {
  aplicarEstadoStripe,
  olvidarEventoStripe,
  registrarEventoStripe,
  usuarioDeCustomer,
} from './repository';
import { stripe } from './stripe';
import { procesarEvento } from './webhook';

jest.mock('./repository', () => ({
  aplicarEstadoStripe: jest.fn(),
  olvidarEventoStripe: jest.fn(),
  registrarEventoStripe: jest.fn(),
  usuarioDeCustomer: jest.fn(),
}));
jest.mock('./stripe', () => ({ stripe: jest.fn() }));

const mockAplicar = aplicarEstadoStripe as jest.Mock;
const mockOlvidar = olvidarEventoStripe as jest.Mock;
const mockRegistrar = registrarEventoStripe as jest.Mock;
const mockUsuarioDeCustomer = usuarioDeCustomer as jest.Mock;
const mockStripe = stripe as jest.Mock;

const recuperarSuscripcion = jest.fn();

const SUSCRIPCION = {
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  metadata: { user_id: 'u-1' },
  items: { data: [{ price: { id: 'price_pro_m' }, current_period_end: 1_787_486_400 }] },
} as unknown as Stripe.Subscription;

function evento(parcial: Partial<Stripe.Event> & { type: string }): Stripe.Event {
  return {
    id: 'evt_1',
    data: { object: {} },
    ...parcial,
  } as unknown as Stripe.Event;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.STRIPE_PRICE_PRO_MENSUAL = 'price_pro_m';
  mockRegistrar.mockResolvedValue(true);
  recuperarSuscripcion.mockResolvedValue(SUSCRIPCION);
  mockStripe.mockReturnValue({ subscriptions: { retrieve: recuperarSuscripcion } });
});

describe('procesarEvento — idempotencia', () => {
  it('descarta un evento ya procesado sin volver a tocar Stripe ni la base', async () => {
    mockRegistrar.mockResolvedValue(false);

    const resultado = await procesarEvento(
      evento({ type: 'customer.subscription.updated', data: { object: SUSCRIPCION } as never }),
    );

    expect(resultado).toEqual({ estado: 'repetido' });
    expect(recuperarSuscripcion).not.toHaveBeenCalled();
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('desmarca el evento si el procesamiento falla, para que el reintento sirva', async () => {
    recuperarSuscripcion.mockRejectedValue(new Error('Stripe caído'));

    await expect(
      procesarEvento(
        evento({ type: 'customer.subscription.updated', data: { object: SUSCRIPCION } as never }),
      ),
    ).rejects.toThrow('Stripe caído');

    expect(mockOlvidar).toHaveBeenCalledWith('evt_1');
  });
});

describe('procesarEvento — sincronización', () => {
  it('vuelca el estado de la suscripción para el usuario de la metadata', async () => {
    const resultado = await procesarEvento(
      evento({ type: 'customer.subscription.updated', data: { object: SUSCRIPCION } as never }),
    );

    expect(resultado).toEqual({ estado: 'procesado' });
    expect(recuperarSuscripcion).toHaveBeenCalledWith('sub_1');
    expect(mockAplicar).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ plan: 'PRO', status: 'ACTIVE', stripeSubscriptionId: 'sub_1' }),
    );
  });

  it('toma la suscripción de la sesión de checkout completada', async () => {
    await procesarEvento(
      evento({
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_1', metadata: { user_id: 'u-9' } } } as never,
      }),
    );

    expect(recuperarSuscripcion).toHaveBeenCalledWith('sub_1');
    // La metadata de la suscripción manda sobre la de la sesión.
    expect(mockAplicar).toHaveBeenCalledWith('u-1', expect.anything());
  });

  it('resuelve al usuario por customer cuando no hay metadata en ningún lado', async () => {
    recuperarSuscripcion.mockResolvedValue({ ...SUSCRIPCION, metadata: {} });
    mockUsuarioDeCustomer.mockResolvedValue('u-por-customer');

    await procesarEvento(
      evento({ type: 'invoice.paid', data: { object: { subscription: 'sub_1' } } as never }),
    );

    expect(mockUsuarioDeCustomer).toHaveBeenCalledWith('cus_1');
    expect(mockAplicar).toHaveBeenCalledWith('u-por-customer', expect.anything());
  });

  it('ignora sin fallar un evento cuyo customer no conocemos', async () => {
    recuperarSuscripcion.mockResolvedValue({ ...SUSCRIPCION, metadata: {} });
    mockUsuarioDeCustomer.mockResolvedValue(null);

    const resultado = await procesarEvento(
      evento({ type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } as never }),
    );

    expect(resultado).toMatchObject({ estado: 'ignorado' });
    expect(mockAplicar).not.toHaveBeenCalled();
  });

  it('ignora los tipos que no atendemos y las facturas sin suscripción', async () => {
    await expect(procesarEvento(evento({ type: 'customer.created' }))).resolves.toMatchObject({
      estado: 'ignorado',
    });
    await expect(
      procesarEvento(evento({ type: 'invoice.paid', data: { object: {} } as never })),
    ).resolves.toMatchObject({ estado: 'ignorado' });
    expect(recuperarSuscripcion).not.toHaveBeenCalled();
  });
});
