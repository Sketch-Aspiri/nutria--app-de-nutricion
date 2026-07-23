import type { EcuacionBmr, Genero, NivelActividad, Objetivo } from '../types';

/**
 * Gasto energético basal (BMR) por las ecuaciones que se usan en consulta en
 * México, y factores de actividad y objetivo para llegar al gasto total.
 *
 * Convención de todo el módulo: el género "Otro" usa la ecuación femenina, que
 * es la más conservadora (estima menos kcal). Documentarlo importa: no es un
 * detalle de implementación, es una decisión clínica visible en el resultado.
 */

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

export const FACTOR_ACTIVIDAD_DEFAULT = FACTOR_ACTIVIDAD.Moderado;

export const ECUACIONES_BMR: EcuacionBmr[] = [
  'mifflin_st_jeor',
  'harris_benedict',
  'fao_oms',
  'katch_mcardle',
];

export const NOMBRE_ECUACION: Record<EcuacionBmr, string> = {
  mifflin_st_jeor: 'Mifflin-St Jeor',
  harris_benedict: 'Harris-Benedict (revisada)',
  fao_oms: 'FAO/OMS/UNU',
  katch_mcardle: 'Katch-McArdle',
};

export const DESCRIPCION_ECUACION: Record<EcuacionBmr, string> = {
  mifflin_st_jeor: 'Referencia general; la más validada en población adulta con sobrepeso.',
  harris_benedict: 'Revisión de Roza-Shizgal (1984). Muy usada en consulta privada.',
  fao_oms: 'Por rangos de edad y sexo; requerida en el ámbito institucional.',
  katch_mcardle: 'Sobre masa magra: la más precisa, pero exige % de grasa medido.',
};

export type DatosBmr = {
  peso: number;
  altura: number;
  edad: number;
  genero: Genero;
  /** Solo lo necesita Katch-McArdle. */
  grasaPct?: number;
};

function exigirDatosBase({ peso, altura, edad }: DatosBmr): void {
  if (peso <= 0 || altura <= 0 || edad <= 0) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
}

function esHombre(genero: Genero): boolean {
  return genero === 'Masculino';
}

/** Mifflin-St Jeor (1990). Ecuación por defecto del panel. */
export function bmrMifflinStJeor(datos: DatosBmr): number {
  exigirDatosBase(datos);
  const base = 10 * datos.peso + 6.25 * datos.altura - 5 * datos.edad;
  return Math.round(esHombre(datos.genero) ? base + 5 : base - 161);
}

/** Harris-Benedict revisada por Roza & Shizgal (1984). */
export function bmrHarrisBenedict(datos: DatosBmr): number {
  exigirDatosBase(datos);
  const { peso, altura, edad } = datos;
  const valor = esHombre(datos.genero)
    ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * edad
    : 447.593 + 9.247 * peso + 3.098 * altura - 4.33 * edad;
  return Math.round(valor);
}

/**
 * FAO/OMS/UNU: solo depende del peso, por tramos de edad y sexo. Por eso da
 * resultados distintos a las demás en pacientes muy altos o muy bajos.
 */
type TramoFao = { edadMax: number; factor: number; constante: number };

/** Tramo de adulto mayor: también hace de respaldo si ninguno coincidiera. */
const FAO_HOMBRE_MAYOR: TramoFao = { edadMax: Infinity, factor: 13.5, constante: 487 };
const FAO_MUJER_MAYOR: TramoFao = { edadMax: Infinity, factor: 10.5, constante: 596 };

const FAO_HOMBRE: TramoFao[] = [
  { edadMax: 3, factor: 60.9, constante: -54 },
  { edadMax: 10, factor: 22.7, constante: 495 },
  { edadMax: 18, factor: 17.5, constante: 651 },
  { edadMax: 30, factor: 15.3, constante: 679 },
  { edadMax: 60, factor: 11.6, constante: 879 },
];

const FAO_MUJER: TramoFao[] = [
  { edadMax: 3, factor: 61, constante: -51 },
  { edadMax: 10, factor: 22.5, constante: 499 },
  { edadMax: 18, factor: 12.2, constante: 746 },
  { edadMax: 30, factor: 14.7, constante: 496 },
  { edadMax: 60, factor: 8.7, constante: 829 },
];

export function bmrFaoOms(datos: DatosBmr): number {
  exigirDatosBase(datos);
  const hombre = esHombre(datos.genero);
  const tabla = hombre ? FAO_HOMBRE : FAO_MUJER;
  const tramo =
    tabla.find((t) => datos.edad <= t.edadMax) ?? (hombre ? FAO_HOMBRE_MAYOR : FAO_MUJER_MAYOR);
  return Math.round(tramo.factor * datos.peso + tramo.constante);
}

/**
 * Katch-McArdle: 370 + 21.6 × masa magra. Solo aplica con % de grasa medido
 * (plicometría o bioimpedancia); sin ese dato lanza `EXPEDIENTE_INCOMPLETO`.
 */
export function bmrKatchMcArdle(datos: DatosBmr): number {
  exigirDatosBase(datos);
  const { grasaPct } = datos;
  if (typeof grasaPct !== 'number' || grasaPct <= 0 || grasaPct >= 100) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
  const magra = datos.peso * (1 - grasaPct / 100);
  return Math.round(370 + 21.6 * magra);
}

const CALCULADORAS: Record<EcuacionBmr, (datos: DatosBmr) => number> = {
  mifflin_st_jeor: bmrMifflinStJeor,
  harris_benedict: bmrHarrisBenedict,
  fao_oms: bmrFaoOms,
  katch_mcardle: bmrKatchMcArdle,
};

export function calcularBmr(ecuacion: EcuacionBmr, datos: DatosBmr): number {
  const calculadora = CALCULADORAS[ecuacion];
  if (!calculadora) throw new Error('ECUACION_DESCONOCIDA');
  return calculadora(datos);
}

export function factorDeActividad(nivel: NivelActividad): number {
  return FACTOR_ACTIVIDAD[nivel] ?? FACTOR_ACTIVIDAD_DEFAULT;
}

export type ComparativaEcuacion = {
  ecuacion: EcuacionBmr;
  nombre: string;
  descripcion: string;
} & ({ disponible: true; bmr: number; tdee: number } | { disponible: false; motivo: string });

/**
 * BMR y TDEE de las cuatro ecuaciones, para que el nutriólogo vea la dispersión
 * antes de elegir. Las que no se pueden calcular se devuelven marcadas con el
 * motivo, nunca omitidas ni rellenadas con un estimado.
 */
export function compararEcuaciones(
  datos: DatosBmr,
  nivelActividad: NivelActividad,
): ComparativaEcuacion[] {
  const factor = factorDeActividad(nivelActividad);

  return ECUACIONES_BMR.map((ecuacion) => {
    const identidad = {
      ecuacion,
      nombre: NOMBRE_ECUACION[ecuacion],
      descripcion: DESCRIPCION_ECUACION[ecuacion],
    };
    try {
      const bmr = calcularBmr(ecuacion, datos);
      return { ...identidad, disponible: true as const, bmr, tdee: Math.round(bmr * factor) };
    } catch {
      return {
        ...identidad,
        disponible: false as const,
        motivo:
          ecuacion === 'katch_mcardle'
            ? 'Requiere % de grasa corporal medido.'
            : 'Faltan peso, altura o edad en el expediente.',
      };
    }
  });
}
