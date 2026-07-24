import Stripe from 'stripe';

import { stripeSecretKey } from './config';

/**
 * Cliente de Stripe.
 *
 * Se construye perezosamente y se memoiza por llave: sin `STRIPE_SECRET_KEY` la
 * app tiene que seguir arrancando (en beta no cobra nada), así que instanciarlo
 * al importar el módulo convertiría una variable ausente en un 500 global.
 */

let cliente: Stripe | null = null;
let llaveDelCliente: string | null = null;

export class StripeNoConfiguradoError extends Error {
  constructor() {
    super('Falta STRIPE_SECRET_KEY en el servidor.');
    this.name = 'StripeNoConfiguradoError';
  }
}

export function stripe(): Stripe {
  const llave = stripeSecretKey();
  if (!llave) throw new StripeNoConfiguradoError();

  if (!cliente || llaveDelCliente !== llave) {
    cliente = new Stripe(llave, {
      // El SDK reintenta 429 y errores de red con backoff; dos intentos bastan
      // para un blip y no alargan tanto la petición del usuario.
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: 'nutria', url: 'https://nutria.mx' },
    });
    llaveDelCliente = llave;
  }
  return cliente;
}
