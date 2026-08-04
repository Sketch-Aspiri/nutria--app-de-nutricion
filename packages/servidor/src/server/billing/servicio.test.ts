/** @jest-environment node */
import { FacturacionNoDisponibleError, crearSesionCheckout, crearSesionPortal } from './servicio';

const ENV_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

describe('crearSesionCheckout', () => {
  it('mantiene cerrado Stripe sin llave aunque los límites estén en producción', async () => {
    process.env.BILLING_MODE = 'produccion';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_CHECKOUT_ENABLED;

    await expect(
      crearSesionCheckout({ userId: 'user-1', plan: 'PRO', periodo: 'MENSUAL' }),
    ).rejects.toMatchObject<Partial<FacturacionNoDisponibleError>>({
      motivo: 'PAGOS_NO_CONFIGURADOS',
      message:
        'Los pagos en línea todavía no están disponibles; contáctanos para activar o renovar tu cuenta.',
    });
  });

  it('no habilita checkout solo porque exista la llave secreta', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_configurada';
    process.env.STRIPE_CHECKOUT_ENABLED = 'false';

    await expect(
      crearSesionCheckout({ userId: 'user-1', plan: 'PRO', periodo: 'MENSUAL' }),
    ).rejects.toMatchObject({ motivo: 'PAGOS_NO_CONFIGURADOS' });
  });
});

describe('crearSesionPortal', () => {
  it('permanece cerrado por API directa cuando el interruptor está apagado', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_configurada';
    process.env.STRIPE_CHECKOUT_ENABLED = 'false';

    await expect(crearSesionPortal('user-1')).rejects.toMatchObject({
      motivo: 'PAGOS_NO_CONFIGURADOS',
    });
  });
});
