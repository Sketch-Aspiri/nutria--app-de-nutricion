import type { CalculoNutricional, Genero, NivelActividad, Objetivo } from './types';

export const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  Sedentario: 1.2,
  Ligero: 1.375,
  Moderado: 1.55,
  Activo: 1.725,
  'Muy activo': 1.9,
};

export const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  'Pérdida de grasa': -0.2,
  'Ganancia muscular': 0.1,
  Mantenimiento: 0,
  'Control de diabetes': -0.1,
  'Mejora deportiva': 0.05,
  Otro: 0,
};

const FACTOR_ACTIVIDAD_DEFAULT = FACTOR_ACTIVIDAD.Moderado;
const KCAL_POR_G_PROTEINA = 4;
const KCAL_POR_G_CARBO = 4;
const KCAL_POR_G_GRASA = 9;

export type DatosCalculo = {
  peso: number;
  altura: number;
  edad: number;
  genero: Genero;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
};

/**
 * Distribución de macros (fracciones de las calorías objetivo) según el objetivo clínico.
 * Suma siempre 1.
 */
export function distribucionMacros(objetivo: Objetivo): { pPct: number; cPct: number; gPct: number } {
  if (objetivo === 'Ganancia muscular' || objetivo === 'Mejora deportiva') {
    return { pPct: 0.3, cPct: 0.45, gPct: 0.25 };
  }
  if (objetivo === 'Control de diabetes') {
    return { pPct: 0.3, cPct: 0.35, gPct: 0.35 };
  }
  return { pPct: 0.3, cPct: 0.4, gPct: 0.3 };
}

/**
 * Cálculo determinístico de requerimiento energético con Mifflin-St Jeor.
 * Género "Otro" usa la fórmula femenina (la más conservadora).
 * Lanza error si peso, altura o edad no son positivos: el expediente está incompleto.
 */
export function calcularTDEE(datos: DatosCalculo): CalculoNutricional {
  const { peso, altura, edad, genero, nivelActividad, objetivo } = datos;
  if (peso <= 0 || altura <= 0 || edad <= 0) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  const bmr = Math.round(genero === 'Masculino' ? base + 5 : base - 161);
  const tdee = Math.round(bmr * (FACTOR_ACTIVIDAD[nivelActividad] ?? FACTOR_ACTIVIDAD_DEFAULT));
  const objetivoCalorias = Math.round(tdee * (1 + (AJUSTE_OBJETIVO[objetivo] ?? 0)));
  const { pPct, cPct, gPct } = distribucionMacros(objetivo);
  return {
    bmr,
    tdee,
    objetivoCalorias,
    proteina_g: Math.round((objetivoCalorias * pPct) / KCAL_POR_G_PROTEINA),
    carbos_g: Math.round((objetivoCalorias * cPct) / KCAL_POR_G_CARBO),
    grasa_g: Math.round((objetivoCalorias * gPct) / KCAL_POR_G_GRASA),
    pPct: Math.round(pPct * 100),
    cPct: Math.round(cPct * 100),
    gPct: Math.round(gPct * 100),
  };
}
