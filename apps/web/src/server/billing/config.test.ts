/**
 * @jest-environment node
 */
import { modoFacturacion, planDelPriceId, priceIdDe, stripeConfigurado, urlBase } from './config';

const ENV_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

describe('modoFacturacion', () => {
  it('sin BILLING_MODE arranca en beta: nadie topa con límites por accidente', () => {
    delete process.env.BILLING_MODE;
    expect(modoFacturacion()).toBe('beta');
  });

  it('solo el valor exacto "produccion" activa los planes', () => {
    process.env.BILLING_MODE = 'produccion';
    expect(modoFacturacion()).toBe('produccion');

    process.env.BILLING_MODE = 'PRODUCCION';
    expect(modoFacturacion()).toBe('beta');

    process.env.BILLING_MODE = 'live';
    expect(modoFacturacion()).toBe('beta');
  });
});

describe('stripeConfigurado', () => {
  it('una variable vacía cuenta como ausente', () => {
    process.env.STRIPE_SECRET_KEY = '   ';
    expect(stripeConfigurado()).toBe(false);

    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(stripeConfigurado()).toBe(true);
  });
});

describe('precios', () => {
  it('resuelve el price id de cada combinación de plan y periodo', () => {
    process.env.STRIPE_PRICE_PRO_MENSUAL = 'price_pro_m';
    process.env.STRIPE_PRICE_PRO_ANUAL = 'price_pro_a';

    expect(priceIdDe('PRO', 'MENSUAL')).toBe('price_pro_m');
    expect(priceIdDe('PRO', 'ANUAL')).toBe('price_pro_a');
  });

  it('no inventa precio para el plan Free ni para lo que no está configurado', () => {
    delete process.env.STRIPE_PRICE_CLINICA_MENSUAL;
    expect(priceIdDe('FREE', 'MENSUAL')).toBeUndefined();
    expect(priceIdDe('CLINICA', 'MENSUAL')).toBeUndefined();
  });

  it('deduce el plan a partir del price id que manda el webhook', () => {
    process.env.STRIPE_PRICE_PRO_ANUAL = 'price_pro_a';
    process.env.STRIPE_PRICE_CLINICA_MENSUAL = 'price_clinica';

    expect(planDelPriceId('price_pro_a')).toBe('PRO');
    expect(planDelPriceId('price_clinica')).toBe('CLINICA');
    expect(planDelPriceId('price_desconocido')).toBeUndefined();
    expect(planDelPriceId(null)).toBeUndefined();
  });
});

describe('urlBase', () => {
  it('prefiere la URL explícita y le quita la diagonal final', () => {
    process.env.APP_URL = 'https://app.nutria.mx/';
    expect(urlBase()).toBe('https://app.nutria.mx');
  });

  it('cae al dominio de Vercel y luego a localhost', () => {
    delete process.env.APP_URL;
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    process.env.VERCEL_URL = 'nutria-preview.vercel.app';
    expect(urlBase()).toBe('https://nutria-preview.vercel.app');

    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(urlBase()).toBe('http://localhost:3000');
  });
});
