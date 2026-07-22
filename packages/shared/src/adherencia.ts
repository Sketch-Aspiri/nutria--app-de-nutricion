export const UMBRAL_ADHERENCIA_BAJA = 50;

/** Regla de negocio compartida: por debajo de 50% se considera adherencia baja y se alerta. */
export function esAdherenciaBaja(adherencia: number): boolean {
  return adherencia < UMBRAL_ADHERENCIA_BAJA;
}

/** Suma de calorías de las comidas de un plan (para validar contra la meta calculada). */
export function totalCaloriasPlan(comidas: Array<{ calorias: number }>): number {
  return comidas.reduce((total, c) => total + (Number.isFinite(c.calorias) ? c.calorias : 0), 0);
}
