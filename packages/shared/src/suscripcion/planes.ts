/**
 * Catálogo de planes y cálculo de entitlements (sección 9 del plan V2).
 *
 * Vive en `packages/shared` porque el servidor decide con estos números y la UI
 * los muestra; duplicarlos garantizaría que un día dejen de coincidir. La única
 * fuente de verdad del plan *vigente* de un usuario sigue siendo la tabla
 * `subscriptions`, que gobierna Stripe vía webhook.
 */

// `PlanSuscripcion` no se reexporta aquí: ya sale del barril por `ia/limites`, y
// un `export *` con el mismo nombre en dos módulos lo vuelve ambiguo y lo omite.
import { type CuotaIA, type PlanSuscripcion, calcularCuota } from '../ia/limites';

/**
 * Etapa comercial del producto.
 *
 * `beta`: mientras se prueba con nutriólogos piloto, todo el mundo está en Free
 * y **sin límites** — ni de pacientes ni de generaciones de IA. `produccion`:
 * los planes y topes de la tabla de abajo se aplican tal cual. El interruptor
 * es una variable de entorno del servidor (`BILLING_MODE`), nunca del cliente:
 * un flag de facturación que el navegador pueda mover no es un flag, es un
 * descuento.
 */
export type ModoFacturacion = 'beta' | 'produccion';

export type PeriodoFacturacion = 'MENSUAL' | 'ANUAL';

export type EstadoSuscripcion = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';

/**
 * Estados en los que el plan contratado sigue dando acceso.
 *
 * `PAST_DUE` entra a propósito: Stripe reintenta el cobro varios días y cortarle
 * el expediente a un nutriólogo por una tarjeta vencida es peor que cobrarle
 * tarde. Cuando Stripe se rinde, el estado pasa a `UNPAID` o `CANCELED` y ahí sí
 * se degrada a Free.
 */
const ESTADOS_VIGENTES: ReadonlySet<string> = new Set(['ACTIVE', 'TRIALING', 'PAST_DUE']);

export function esSuscripcionVigente(estado: string): boolean {
  return ESTADOS_VIGENTES.has(estado);
}

/** `null` = sin tope. Free es el único plan con cupo de pacientes activos. */
export const LIMITE_PACIENTES_ACTIVOS: Record<PlanSuscripcion, number | null> = {
  FREE: 3,
  PRO: null,
  CLINICA: null,
};

/** Plantillas de plan guardadas. Free tiene un cupo simbólico; el resto no. */
export const LIMITE_PLANTILLAS: Record<PlanSuscripcion, number | null> = {
  FREE: 3,
  PRO: null,
  CLINICA: null,
};

/** El PDF sin la marca de nutria es una característica de pago. */
export const PDF_MARCA_BLANCA: Record<PlanSuscripcion, boolean> = {
  FREE: false,
  PRO: true,
  CLINICA: true,
};

export type PrecioPlan = {
  periodo: PeriodoFacturacion;
  /** En centavos, como Stripe. Nunca flotantes para dinero. */
  centavos: number;
  moneda: 'MXN';
};

export type PlanCatalogo = {
  clave: PlanSuscripcion;
  nombre: string;
  descripcion: string;
  precios: PrecioPlan[];
  incluye: string[];
  /** Días de prueba que Stripe aplica al contratar. 0 = sin prueba. */
  diasPrueba: number;
};

export const CATALOGO_PLANES: readonly PlanCatalogo[] = [
  {
    clave: 'FREE',
    nombre: 'Free',
    descripcion: 'Para empezar y probar la plataforma con tus primeros pacientes.',
    precios: [{ periodo: 'MENSUAL', centavos: 0, moneda: 'MXN' }],
    incluye: [
      '3 pacientes activos',
      '15 generaciones de IA al mes',
      'Planes, cálculo y PDF con marca de nutria',
      'Agenda y mensajes',
    ],
    diasPrueba: 0,
  },
  {
    clave: 'PRO',
    nombre: 'Pro',
    descripcion: 'Para el nutriólogo en consulta privada con cartera propia.',
    precios: [
      { periodo: 'MENSUAL', centavos: 49_900, moneda: 'MXN' },
      { periodo: 'ANUAL', centavos: 499_000, moneda: 'MXN' },
    ],
    incluye: [
      'Pacientes ilimitados',
      '150 generaciones de IA al mes',
      'PDF con tu marca (sin logo de nutria)',
      'Plantillas de plan ilimitadas',
      '14 días de prueba',
    ],
    diasPrueba: 14,
  },
  {
    clave: 'CLINICA',
    nombre: 'Clínica',
    descripcion: 'Para consultorios con varios nutriólogos compartiendo pacientes.',
    precios: [{ periodo: 'MENSUAL', centavos: 129_900, moneda: 'MXN' }],
    incluye: [
      'Todo lo de Pro',
      '500 generaciones de IA al mes',
      '3 asientos de nutriólogo (multi-asiento real en V2.1)',
      'Soporte prioritario',
    ],
    diasPrueba: 0,
  },
];

export function planDelCatalogo(clave: PlanSuscripcion): PlanCatalogo {
  const encontrado = CATALOGO_PLANES.find((p) => p.clave === clave);
  // El catálogo cubre el enum completo; si no, es un plan nuevo sin dar de alta.
  if (!encontrado) throw new Error(`Plan sin ficha en el catálogo: ${clave}`);
  return encontrado;
}

export function precioDe(
  clave: PlanSuscripcion,
  periodo: PeriodoFacturacion,
): PrecioPlan | undefined {
  return planDelCatalogo(clave).precios.find((p) => p.periodo === periodo);
}

/** `49900` → `"$499.00 MXN"`. Formato mexicano, sin depender del locale del navegador. */
export function formatearPrecioMXN(centavos: number): string {
  const pesos = Math.trunc(centavos / 100);
  const resto = String(Math.abs(centavos) % 100).padStart(2, '0');
  const conSeparador = pesos.toLocaleString('es-MX');
  return `$${conSeparador}.${resto} MXN`;
}

export type LimiteUso = {
  usados: number;
  /** `null` = ilimitado. */
  limite: number | null;
  restantes: number | null;
  alcanzado: boolean;
};

export function calcularLimiteUso(usados: number, limite: number | null): LimiteUso {
  // Un contador negativo o no entero solo puede venir de datos corruptos.
  const consumidos = Number.isFinite(usados) && usados > 0 ? Math.floor(usados) : 0;
  if (limite === null) {
    return { usados: consumidos, limite: null, restantes: null, alcanzado: false };
  }
  const restantes = Math.max(limite - consumidos, 0);
  return { usados: consumidos, limite, restantes, alcanzado: restantes === 0 };
}

/**
 * Lo que un usuario puede hacer *ahora mismo*. Los handlers preguntan por esto
 * antes de crear un paciente o de generar con IA; el frontend lo usa solo para
 * avisar antes de chocar, nunca como control.
 */
export type Entitlements = {
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  modo: ModoFacturacion;
  pacientes: LimiteUso;
  ia: CuotaIA;
  marcaBlanca: boolean;
  plantillas: LimiteUso;
};

export type EntradaEntitlements = {
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  modo: ModoFacturacion;
  pacientesActivos: number;
  plantillasGuardadas: number;
  generacionesIaDelMes: number;
};

export function calcularEntitlements(entrada: EntradaEntitlements): Entitlements {
  const { modo } = entrada;
  // Una suscripción vencida vale lo mismo que no tenerla: se degrada a Free.
  const plan = esSuscripcionVigente(entrada.estado) ? entrada.plan : 'FREE';
  const beta = modo === 'beta';

  return {
    plan,
    estado: entrada.estado,
    modo,
    pacientes: calcularLimiteUso(
      entrada.pacientesActivos,
      beta ? null : LIMITE_PACIENTES_ACTIVOS[plan],
    ),
    ia: calcularCuota(plan, entrada.generacionesIaDelMes, modo),
    marcaBlanca: beta || PDF_MARCA_BLANCA[plan],
    plantillas: calcularLimiteUso(
      entrada.plantillasGuardadas,
      beta ? null : LIMITE_PLANTILLAS[plan],
    ),
  };
}
