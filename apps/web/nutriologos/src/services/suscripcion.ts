import type { CuotaIA } from '@nutria/shared';

import { pedir } from '@/services/http';

/**
 * Cliente de `/api/v1/billing`. Espejo del contrato que sirve
 * `src/server/billing/serializers.ts`.
 *
 * Nada de lo que hay aquí es un control de acceso: los topes se aplican en el
 * servidor. Esto solo existe para que el nutriólogo vea en qué va antes de
 * chocar con un 402 a mitad de un alta.
 */

export type LimiteUsoApi = {
  usados: number;
  /** `null` = ilimitado. */
  limite: number | null;
  restantes: number | null;
  alcanzado: boolean;
};

export type PrecioApi = { periodo: 'MENSUAL' | 'ANUAL'; centavos: number; moneda: string };

export type PlanCatalogoApi = {
  clave: 'FREE' | 'PRO' | 'CLINICA';
  nombre: string;
  descripcion: string;
  precios: PrecioApi[];
  incluye: string[];
  dias_prueba: number;
  contratable: boolean;
};

export type SuscripcionApi = {
  plan: 'FREE' | 'PRO' | 'CLINICA';
  estado: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  modo: 'beta' | 'produccion';
  periodo_fin: string | null;
  acceso_expira: string | null;
  contacto_renovacion: string;
  cancela_al_final: boolean;
  pagos_habilitados: boolean;
  tiene_suscripcion_stripe: boolean;
  entitlements: {
    pacientes: LimiteUsoApi;
    plantillas: LimiteUsoApi;
    ia: CuotaIA;
    marca_blanca: boolean;
  };
  catalogo: PlanCatalogoApi[];
};

export function obtenerSuscripcion(): Promise<SuscripcionApi> {
  return pedir<SuscripcionApi>('/api/v1/billing/subscription');
}

export function iniciarCheckout(payload: {
  plan: 'PRO' | 'CLINICA';
  periodo: 'MENSUAL' | 'ANUAL';
}): Promise<{ url: string }> {
  return pedir<{ url: string }>('/api/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function abrirPortal(): Promise<{ url: string }> {
  return pedir<{ url: string }>('/api/v1/billing/portal', { method: 'POST' });
}
