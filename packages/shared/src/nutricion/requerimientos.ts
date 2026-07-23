import type { NivelActividad, Objetivo } from '../types';

/**
 * Requerimientos de macronutrimentos y de agua. Son las reglas que traducen un
 * objetivo clínico en números defendibles ante el paciente.
 */

export const KCAL_POR_G_PROTEINA = 4;
export const KCAL_POR_G_CARBO = 4;
export const KCAL_POR_G_GRASA = 9;

/**
 * Distribución de macros (fracciones de las calorías objetivo) según el objetivo
 * clínico. Suma siempre 1.
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

/** Rango de proteína en g/kg de peso por objetivo, con el valor que se sugiere. */
type RangoProteina = { min: number; sugerido: number; max: number };

const PROTEINA_POR_OBJETIVO: Record<Objetivo, RangoProteina> = {
  'Pérdida de grasa': { min: 1.2, sugerido: 1.5, max: 1.8 },
  'Ganancia muscular': { min: 1.6, sugerido: 1.8, max: 2.2 },
  Mantenimiento: { min: 0.8, sugerido: 1.0, max: 1.2 },
  'Control de diabetes': { min: 0.8, sugerido: 1.0, max: 1.2 },
  'Mejora deportiva': { min: 1.4, sugerido: 1.6, max: 2.0 },
  Otro: { min: 0.8, sugerido: 1.0, max: 1.2 },
};

/**
 * Tope clínico duro: en enfermedad renal crónica sin diálisis la restricción
 * proteica es parte del tratamiento, así que gana sobre el objetivo del plan.
 */
export const TOPE_PROTEINA_RENAL = 0.8;
const CONDICION_RENAL = /renal/i;

export const PROTEINA_G_POR_KG_MAX = 2.5;

export type RequerimientoProteina = {
  gPorKgMin: number;
  gPorKgSugerido: number;
  gPorKgMax: number;
  gramos: number;
  /** true cuando una condición del expediente bajó el rango. */
  limitadoPorCondicion: boolean;
  advertencias: string[];
};

/**
 * Proteína en g/kg según objetivo y condiciones, con tope clínico.
 * `gPorKg` permite al nutriólogo fijar su propio valor; se acota a
 * `PROTEINA_G_POR_KG_MAX` y al tope renal cuando aplica, y el recorte se reporta
 * en `advertencias` en lugar de aplicarse en silencio.
 */
export function requerimientoProteina(datos: {
  pesoKg: number;
  objetivo: Objetivo;
  condiciones?: string[];
  gPorKg?: number;
}): RequerimientoProteina {
  const { pesoKg, objetivo, condiciones = [], gPorKg } = datos;
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }

  const advertencias: string[] = [];
  const rangoBase = PROTEINA_POR_OBJETIVO[objetivo] ?? PROTEINA_POR_OBJETIVO.Otro;
  const hayDanoRenal = condiciones.some((condicion) => CONDICION_RENAL.test(condicion));

  let rango = rangoBase;
  if (hayDanoRenal) {
    rango = {
      min: Math.min(rangoBase.min, TOPE_PROTEINA_RENAL),
      sugerido: TOPE_PROTEINA_RENAL,
      max: TOPE_PROTEINA_RENAL,
    };
    advertencias.push(
      `Enfermedad renal en el expediente: la proteína se limita a ${TOPE_PROTEINA_RENAL} g/kg.`,
    );
  }

  let elegido = typeof gPorKg === 'number' && gPorKg > 0 ? gPorKg : rango.sugerido;
  if (elegido > PROTEINA_G_POR_KG_MAX) {
    advertencias.push(
      `Se recortó la proteína a ${PROTEINA_G_POR_KG_MAX} g/kg, el tope clínico del módulo.`,
    );
    elegido = PROTEINA_G_POR_KG_MAX;
  }
  if (elegido > rango.max) {
    advertencias.push(
      `El valor pedido supera el máximo de ${rango.max} g/kg para este caso; se ajustó.`,
    );
    elegido = rango.max;
  }

  return {
    gPorKgMin: rango.min,
    gPorKgSugerido: rango.sugerido,
    gPorKgMax: rango.max,
    gramos: Math.round(elegido * pesoKg),
    limitadoPorCondicion: hayDanoRenal,
    advertencias,
  };
}

/**
 * Agua: 35 ml/kg hasta los 55 años y 30 ml/kg a partir de ahí (la capacidad
 * renal de concentración baja con la edad), más 500 ml cuando el nivel de
 * actividad es alto, por las pérdidas por sudor.
 */
const ML_POR_KG_JOVEN = 35;
const ML_POR_KG_MAYOR = 30;
const EDAD_CORTE_HIDRATACION = 55;
const EXTRA_POR_ACTIVIDAD_ML = 500;
const NIVELES_ACTIVIDAD_ALTA: NivelActividad[] = ['Activo', 'Muy activo'];

export type RequerimientoAgua = {
  ml: number;
  litros: number;
  mlPorKg: number;
  extraPorActividadMl: number;
};

export function requerimientoAgua(datos: {
  pesoKg: number;
  edad: number;
  nivelActividad: NivelActividad;
}): RequerimientoAgua {
  const { pesoKg, edad, nivelActividad } = datos;
  if (!Number.isFinite(pesoKg) || pesoKg <= 0 || !Number.isFinite(edad) || edad <= 0) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }

  const mlPorKg = edad < EDAD_CORTE_HIDRATACION ? ML_POR_KG_JOVEN : ML_POR_KG_MAYOR;
  const extra = NIVELES_ACTIVIDAD_ALTA.includes(nivelActividad) ? EXTRA_POR_ACTIVIDAD_ML : 0;
  const ml = Math.round(mlPorKg * pesoKg + extra);

  return { ml, litros: Math.round(ml / 100) / 10, mlPorKg, extraPorActividadMl: extra };
}
