import { z } from 'zod';

/** Entrada de `POST /api/v1/billing/checkout`. */
export const checkoutSchema = z
  .object({
    // Free no se "contrata": es el estado por defecto de toda cuenta.
    plan: z.enum(['PRO', 'CLINICA']),
    periodo: z.enum(['MENSUAL', 'ANUAL']).default('MENSUAL'),
  })
  .meta({ id: 'BillingCheckoutInput' });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
