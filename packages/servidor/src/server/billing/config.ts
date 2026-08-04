import type { ModoFacturacion, PeriodoFacturacion, PlanSuscripcion } from '@nutria/shared';

/**
 * Configuración de facturación (sección 9 del plan V2).
 *
 * Todo se lee de `process.env` en cada llamada, no al importar el módulo: los
 * tests y los E2E cambian el modo entre casos, y una constante evaluada al
 * cargar el módulo se quedaría con el valor del primer import.
 */

/**
 * Etapa comercial. Mientras `BILLING_MODE` no diga `produccion`, el producto
 * está en beta: todo el mundo en Free y **sin límites** de pacientes ni de IA.
 * El valor por defecto es deliberadamente `beta` — si alguien despliega sin
 * configurar Stripe, el resultado es una app usable, no una app que cobra mal.
 */
export function modoFacturacion(): ModoFacturacion {
  return process.env.BILLING_MODE?.trim() === 'produccion' ? 'produccion' : 'beta';
}

export function esBeta(): boolean {
  return modoFacturacion() === 'beta';
}

function env(nombre: string): string | undefined {
  const valor = process.env[nombre]?.trim();
  return valor ? valor : undefined;
}

export function stripeSecretKey(): string | undefined {
  return env('STRIPE_SECRET_KEY');
}

export function stripeWebhookSecret(): string | undefined {
  return env('STRIPE_WEBHOOK_SECRET');
}

/** Sin llave secreta no hay checkout ni portal; la app sigue funcionando en beta. */
export function stripeConfigurado(): boolean {
  return stripeSecretKey() !== undefined;
}

/**
 * Feature flag comercial separado de las credenciales técnicas de Stripe.
 * Una llave puede existir para procesar webhooks sin que eso publique Checkout.
 */
export function stripeCheckoutHabilitado(): boolean {
  return process.env.STRIPE_CHECKOUT_ENABLED?.trim() === 'true' && stripeConfigurado();
}

/**
 * Precios de Stripe por (plan, periodo). Se declaran uno por variable en lugar
 * de un JSON en una sola: así una variable mal puesta rompe un plan y no todos.
 */
const VARIABLE_DE_PRECIO: Record<string, string> = {
  'PRO:MENSUAL': 'STRIPE_PRICE_PRO_MENSUAL',
  'PRO:ANUAL': 'STRIPE_PRICE_PRO_ANUAL',
  'CLINICA:MENSUAL': 'STRIPE_PRICE_CLINICA_MENSUAL',
};

export function priceIdDe(plan: PlanSuscripcion, periodo: PeriodoFacturacion): string | undefined {
  const variable = VARIABLE_DE_PRECIO[`${plan}:${periodo}`];
  return variable ? env(variable) : undefined;
}

/** Mapa inverso: el webhook llega con el `price` y hay que deducir el plan. */
export function planDelPriceId(priceId: string | null | undefined): PlanSuscripcion | undefined {
  if (!priceId) return undefined;
  for (const [clave, variable] of Object.entries(VARIABLE_DE_PRECIO)) {
    if (env(variable) === priceId) return clave.split(':')[0] as PlanSuscripcion;
  }
  return undefined;
}

/**
 * URL pública a la que Stripe devuelve al usuario. En Vercel llega como
 * `VERCEL_PROJECT_PRODUCTION_URL` sin protocolo; en local vale `AUTH_URL`.
 */
export function urlBase(): string {
  const explicita = env('APP_URL') ?? env('AUTH_URL') ?? env('NEXTAUTH_URL');
  if (explicita) return explicita.replace(/\/+$/, '');

  const vercel = env('VERCEL_PROJECT_PRODUCTION_URL') ?? env('VERCEL_URL');
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}
