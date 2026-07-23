import type { Genero, Pliegues } from '../types';

/**
 * Índices antropométricos con los cortes que se usan en consulta en México
 * (OMS; NOM-008-SSA3-2017 para talla baja; Durnin & Womersley 1974 + Siri).
 *
 * Ninguna función inventa datos: si falta una medida lanza `EXPEDIENTE_INCOMPLETO`,
 * porque un valor supuesto se convertiría en una recomendación clínica falsa.
 */

const IMC_PESO_IDEAL = 22;
const IMC_SALUDABLE_MIN = 18.5;
const IMC_SALUDABLE_MAX = 24.9;

/** Talla por debajo de la cual la NOM-008 baja el corte de obesidad a IMC 25. */
const TALLA_BAJA_CM: Record<Genero, number> = {
  Femenino: 150,
  Masculino: 160,
  // Sin talla de referencia propia se usa la más conservadora (la que declara
  // talla baja con menos estatura), para no clasificar obesidad de más.
  Otro: 150,
};

export type NivelRiesgo = 'bajo' | 'normal' | 'aumentado' | 'alto' | 'muy alto';

function exigirPositivo(...valores: number[]): void {
  if (valores.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
}

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** Índice de masa corporal en kg/m², con un decimal. */
export function imc(pesoKg: number, alturaCm: number): number {
  exigirPositivo(pesoKg, alturaCm);
  const alturaM = alturaCm / 100;
  return redondear(pesoKg / (alturaM * alturaM), 1);
}

export type ClasificacionImc = {
  categoria: string;
  riesgo: NivelRiesgo;
  /** true cuando se aplicó el corte de talla baja de la NOM-008. */
  cortesTallaBaja: boolean;
};

/**
 * Clasificación de la OMS. Si se pasan `alturaCm` y `genero` y el paciente es de
 * talla baja (mujer < 150 cm, hombre < 160 cm), se aplica el criterio de la
 * NOM-008-SSA3: obesidad a partir de IMC 25, no de 30.
 */
export function clasificarImc(
  valorImc: number,
  paciente?: { alturaCm?: number; genero?: Genero },
): ClasificacionImc {
  exigirPositivo(valorImc);

  const alturaCm = paciente?.alturaCm;
  const genero = paciente?.genero ?? 'Otro';
  const tallaBaja =
    typeof alturaCm === 'number' && alturaCm > 0 && alturaCm < TALLA_BAJA_CM[genero];

  if (valorImc < 18.5) {
    return { categoria: 'Bajo peso', riesgo: 'aumentado', cortesTallaBaja: tallaBaja };
  }
  if (valorImc < 25) {
    return { categoria: 'Peso normal', riesgo: 'normal', cortesTallaBaja: tallaBaja };
  }
  if (tallaBaja) {
    return { categoria: 'Obesidad (talla baja)', riesgo: 'alto', cortesTallaBaja: true };
  }
  if (valorImc < 30) {
    return { categoria: 'Sobrepeso', riesgo: 'aumentado', cortesTallaBaja: false };
  }
  if (valorImc < 35) {
    return { categoria: 'Obesidad grado I', riesgo: 'alto', cortesTallaBaja: false };
  }
  if (valorImc < 40) {
    return { categoria: 'Obesidad grado II', riesgo: 'muy alto', cortesTallaBaja: false };
  }
  return { categoria: 'Obesidad grado III', riesgo: 'muy alto', cortesTallaBaja: false };
}

export type IndiceConRiesgo = {
  valor: number;
  riesgo: NivelRiesgo;
  /** Corte a partir del cual el índice se considera de riesgo para este paciente. */
  corte: number;
};

/** Corte de riesgo cardiometabólico de la OMS por sexo. */
const CORTE_CINTURA_CADERA: Record<Genero, number> = {
  Masculino: 0.9,
  Femenino: 0.85,
  Otro: 0.85,
};

/** Índice cintura/cadera. Riesgo aumentado desde 0.90 (hombre) / 0.85 (mujer). */
export function indiceCinturaCadera(
  cinturaCm: number,
  caderaCm: number,
  genero: Genero,
): IndiceConRiesgo {
  exigirPositivo(cinturaCm, caderaCm);
  const corte = CORTE_CINTURA_CADERA[genero] ?? CORTE_CINTURA_CADERA.Otro;
  const valor = redondear(cinturaCm / caderaCm, 2);
  return { valor, corte, riesgo: valor >= corte ? 'alto' : 'normal' };
}

/**
 * Índice cintura/talla. Independiente del sexo: 0.5 marca riesgo aumentado y
 * 0.6 riesgo alto ("tu cintura debe medir menos de la mitad de tu estatura").
 */
export function indiceCinturaTalla(cinturaCm: number, alturaCm: number): IndiceConRiesgo {
  exigirPositivo(cinturaCm, alturaCm);
  const valor = redondear(cinturaCm / alturaCm, 2);
  const riesgo: NivelRiesgo = valor >= 0.6 ? 'alto' : valor >= 0.5 ? 'aumentado' : 'normal';
  return { valor, corte: 0.5, riesgo };
}

/**
 * Coeficientes de Durnin & Womersley (1974) para la densidad corporal a partir
 * del logaritmo de la suma de 4 pliegues: D = c − m × log10(Σ pliegues).
 */
type CoeficientesDensidad = { c: number; m: number };

/** Último tramo (50 años en adelante), también usado como respaldo. */
const DENSIDAD_HOMBRE_MAYOR: CoeficientesDensidad = { c: 1.1715, m: 0.0779 };
const DENSIDAD_MUJER_MAYOR: CoeficientesDensidad = { c: 1.1339, m: 0.0645 };

const DENSIDAD_HOMBRE: [edadMax: number, coef: CoeficientesDensidad][] = [
  [19, { c: 1.162, m: 0.063 }],
  [29, { c: 1.1631, m: 0.0632 }],
  [39, { c: 1.1422, m: 0.0544 }],
  [49, { c: 1.162, m: 0.07 }],
];

const DENSIDAD_MUJER: [edadMax: number, coef: CoeficientesDensidad][] = [
  [19, { c: 1.1549, m: 0.0678 }],
  [29, { c: 1.1599, m: 0.0717 }],
  [39, { c: 1.1423, m: 0.0632 }],
  [49, { c: 1.1333, m: 0.0612 }],
];

function coeficientesDensidad(edad: number, genero: Genero): CoeficientesDensidad {
  // "Otro" usa la tabla femenina, igual que el resto del módulo.
  const hombre = genero === 'Masculino';
  const tabla = hombre ? DENSIDAD_HOMBRE : DENSIDAD_MUJER;
  // La tabla original arranca en 17 años; por debajo se usa su primer tramo.
  const fila = tabla.find(([edadMax]) => edad <= edadMax);
  if (fila) return fila[1];
  return hombre ? DENSIDAD_HOMBRE_MAYOR : DENSIDAD_MUJER_MAYOR;
}

export type ResultadoGrasaCorporal = {
  grasaPct: number;
  densidadCorporal: number;
  sumaPliegues: number;
  masaGrasaKg: number | null;
  masaMagraKg: number | null;
};

/**
 * % de grasa corporal por los 4 pliegues de Durnin-Womersley (bicipital,
 * tricipital, subescapular y suprailiaco, en mm), convertidos con la ecuación
 * de Siri. Los cuatro pliegues son obligatorios: la ecuación se ajustó sobre la
 * suma completa y omitir uno la sesga.
 */
export function grasaCorporalDurninWomersley(
  pliegues: Pliegues,
  edad: number,
  genero: Genero,
  pesoKg?: number,
): ResultadoGrasaCorporal {
  const medidas = [
    pliegues.tricipital,
    pliegues.bicipital,
    pliegues.subescapular,
    pliegues.suprailiaco,
  ];
  if (medidas.some((valor) => typeof valor !== 'number')) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
  const completas = medidas as number[];
  exigirPositivo(edad, ...completas);

  const suma = completas.reduce((total, valor) => total + valor, 0);
  const { c, m } = coeficientesDensidad(edad, genero);
  const densidad = c - m * Math.log10(suma);
  const grasaPct = redondear((4.95 / densidad - 4.5) * 100, 1);

  const tienePeso = typeof pesoKg === 'number' && pesoKg > 0;
  const masaGrasaKg = tienePeso ? redondear((pesoKg * grasaPct) / 100, 1) : null;

  return {
    grasaPct,
    densidadCorporal: redondear(densidad, 4),
    sumaPliegues: redondear(suma, 1),
    masaGrasaKg,
    masaMagraKg: tienePeso && masaGrasaKg !== null ? redondear(pesoKg - masaGrasaKg, 1) : null,
  };
}

/** Masa libre de grasa, insumo de Katch-McArdle. */
export function masaMagra(pesoKg: number, grasaPct: number): number {
  exigirPositivo(pesoKg);
  if (!Number.isFinite(grasaPct) || grasaPct <= 0 || grasaPct >= 100) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }
  return redondear(pesoKg * (1 - grasaPct / 100), 1);
}

export type PesoIdeal = {
  /** Peso teórico a IMC 22, el centro del rango saludable. */
  porImc: number;
  /** Fórmula de Hamwi, todavía habitual en consulta. */
  hamwi: number;
  rangoSaludable: { min: number; max: number };
};

const CM_POR_PULGADA = 2.54;
const HAMWI_BASE: Record<Genero, { kg: number; porPulgada: number }> = {
  Masculino: { kg: 48, porPulgada: 2.7 },
  Femenino: { kg: 45.5, porPulgada: 2.2 },
  Otro: { kg: 45.5, porPulgada: 2.2 },
};

/** Peso ideal y rango saludable de peso para una talla dada. */
export function pesoIdeal(alturaCm: number, genero: Genero): PesoIdeal {
  exigirPositivo(alturaCm);
  const alturaM2 = (alturaCm / 100) ** 2;
  const base = HAMWI_BASE[genero] ?? HAMWI_BASE.Otro;
  const pulgadasSobre152 = Math.max(0, (alturaCm - 152.4) / CM_POR_PULGADA);

  return {
    porImc: redondear(IMC_PESO_IDEAL * alturaM2, 1),
    hamwi: redondear(base.kg + base.porPulgada * pulgadasSobre152, 1),
    rangoSaludable: {
      min: redondear(IMC_SALUDABLE_MIN * alturaM2, 1),
      max: redondear(IMC_SALUDABLE_MAX * alturaM2, 1),
    },
  };
}

const FACTOR_PESO_AJUSTADO = 0.25;

/**
 * Peso ajustado = peso ideal + 0.25 × (peso actual − peso ideal).
 * Se usa como insumo del gasto energético en obesidad, donde el peso real
 * sobreestima el requerimiento porque el tejido adiposo es poco activo.
 */
export function pesoAjustado(pesoActualKg: number, pesoIdealKg: number): number {
  exigirPositivo(pesoActualKg, pesoIdealKg);
  return redondear(pesoIdealKg + FACTOR_PESO_AJUSTADO * (pesoActualKg - pesoIdealKg), 1);
}

/** El peso ajustado solo se recomienda a partir de obesidad (IMC ≥ 30). */
export function requierePesoAjustado(valorImc: number): boolean {
  return Number.isFinite(valorImc) && valorImc >= 30;
}
