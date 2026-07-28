import { CATALOGO_PLANES, type CuotaIA, type LimiteUso } from '@nutria/shared';

import { priceIdDe, stripeConfigurado } from './config';
import type { EntitlementsConEstado } from './entitlements';

/**
 * Forma pública de la suscripción, según `rules/api-conventions.md`: claves en
 * `snake_case` y fechas ISO. Es lo que consumen la barra lateral, el badge del
 * encabezado y la página `/suscripcion`.
 */

export type LimiteUsoApi = {
  usados: number;
  limite: number | null;
  restantes: number | null;
  alcanzado: boolean;
};

export type PrecioApi = { periodo: string; centavos: number; moneda: string };

export type PlanCatalogoApi = {
  clave: string;
  nombre: string;
  descripcion: string;
  precios: PrecioApi[];
  incluye: string[];
  dias_prueba: number;
  /** `false` cuando falta el price id en el servidor: la UI no ofrece contratarlo. */
  contratable: boolean;
};

export type SuscripcionApi = {
  plan: string;
  estado: string;
  modo: string;
  periodo_fin: string | null;
  cancela_al_final: boolean;
  /** El checkout y el portal solo existen si hay llave de Stripe y no es beta. */
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

function limite(uso: LimiteUso): LimiteUsoApi {
  return {
    usados: uso.usados,
    limite: uso.limite,
    restantes: uso.restantes,
    alcanzado: uso.alcanzado,
  };
}

export function serializarSuscripcion(entitlements: EntitlementsConEstado): SuscripcionApi {
  const { suscripcion } = entitlements;
  const pagosHabilitados = entitlements.modo === 'produccion' && stripeConfigurado();

  return {
    plan: entitlements.plan,
    estado: entitlements.estado,
    modo: entitlements.modo,
    periodo_fin: suscripcion.periodoFin?.toISOString() ?? null,
    cancela_al_final: suscripcion.cancelaAlFinal,
    pagos_habilitados: pagosHabilitados,
    tiene_suscripcion_stripe: suscripcion.stripeSubscriptionId !== null,
    entitlements: {
      pacientes: limite(entitlements.pacientes),
      plantillas: limite(entitlements.plantillas),
      ia: entitlements.ia,
      marca_blanca: entitlements.marcaBlanca,
    },
    catalogo: CATALOGO_PLANES.map((plan) => ({
      clave: plan.clave,
      nombre: plan.nombre,
      descripcion: plan.descripcion,
      precios: plan.precios.map((p) => ({
        periodo: p.periodo,
        centavos: p.centavos,
        moneda: p.moneda,
      })),
      incluye: [...plan.incluye],
      dias_prueba: plan.diasPrueba,
      // Un plan sin `price_id` configurado en el servidor no se puede contratar
      // aunque Stripe esté listo: el checkout fallaría al llegar a la pasarela.
      contratable:
        plan.clave !== 'FREE' &&
        pagosHabilitados &&
        plan.precios.some((p) => priceIdDe(plan.clave, p.periodo) !== undefined),
    })),
  };
}
