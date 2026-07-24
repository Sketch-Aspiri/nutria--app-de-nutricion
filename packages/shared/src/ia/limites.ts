/**
 * Cuota mensual de generaciones de IA por plan (sección 8 del plan V2).
 *
 * Vive en `packages/shared` porque el servidor la aplica y la UI la muestra;
 * duplicar los números garantizaría que un día dejen de coincidir. La única
 * fuente de verdad del plan vigente sigue siendo la tabla `subscriptions`.
 */

export type PlanSuscripcion = 'FREE' | 'PRO' | 'CLINICA';

export const LIMITE_GENERACIONES_IA: Record<PlanSuscripcion, number> = {
  FREE: 15,
  PRO: 150,
  CLINICA: 500,
};

export type CuotaIA = {
  plan: PlanSuscripcion;
  /**
   * `null` = sin tope. Ocurre durante la beta comercial, en la que todos los
   * usuarios están en Free y la IA no se raciona. No puede ser `Infinity`:
   * `JSON.stringify(Infinity)` produce `null` de todos modos, y es mejor que el
   * contrato lo diga que descubrirlo del lado del navegador.
   */
  limite: number | null;
  usadas: number;
  restantes: number | null;
  agotada: boolean;
  ilimitada: boolean;
};

/** El mes de corte en formato `YYYY-MM`, que es la clave de `ai_usage`. */
export function mesDeUso(fecha: Date = new Date()): string {
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${fecha.getUTCFullYear()}-${mes}`;
}

export function calcularCuota(
  plan: PlanSuscripcion,
  usadas: number,
  modo: 'beta' | 'produccion' = 'produccion',
): CuotaIA {
  // Un contador negativo o no entero solo puede venir de datos corruptos; se
  // trata como cero para no regalar generaciones.
  const consumidas = Number.isFinite(usadas) && usadas > 0 ? Math.floor(usadas) : 0;

  if (modo === 'beta') {
    return {
      plan,
      limite: null,
      usadas: consumidas,
      restantes: null,
      agotada: false,
      ilimitada: true,
    };
  }

  const limite = LIMITE_GENERACIONES_IA[plan];
  const restantes = Math.max(limite - consumidas, 0);
  return {
    plan,
    limite,
    usadas: consumidas,
    restantes,
    agotada: restantes === 0,
    ilimitada: false,
  };
}
