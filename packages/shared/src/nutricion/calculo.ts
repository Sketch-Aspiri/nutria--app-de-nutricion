import type {
  CalculoNutricional,
  EcuacionBmr,
  Genero,
  ModoProteina,
  NivelActividad,
  Objetivo,
} from '../types';

import { imc, pesoAjustado, pesoIdeal, requierePesoAjustado } from './antropometria';
import { AJUSTE_OBJETIVO, calcularBmr, factorDeActividad } from './energia';
import {
  KCAL_POR_G_CARBO,
  KCAL_POR_G_GRASA,
  KCAL_POR_G_PROTEINA,
  distribucionMacros,
  requerimientoAgua,
  requerimientoProteina,
} from './requerimientos';

/**
 * Cálculo del requerimiento energético y de macronutrimentos.
 *
 * Determinístico y auditable: la ecuación, el peso que entró en ella y los
 * ajustes aplicados salen en el resultado, para que el nutriólogo pueda
 * reconstruir el número frente al paciente. Lo que el módulo tuvo que recortar
 * se devuelve en `advertencias`, nunca se aplica en silencio.
 */

export const ECUACION_POR_DEFECTO: EcuacionBmr = 'mifflin_st_jeor';

export type DatosCalculo = {
  peso: number;
  altura: number;
  edad: number;
  genero: Genero;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
  /** Por defecto Mifflin-St Jeor. */
  ecuacion?: EcuacionBmr;
  /** % de grasa medido; obligatorio para Katch-McArdle. */
  grasaPct?: number;
  /** Por defecto la proteína sale del % de las calorías, no de g/kg. */
  modoProteina?: ModoProteina;
  /** g/kg elegidos por el nutriólogo; si falta, se usa el sugerido del objetivo. */
  proteinaGPorKg?: number;
  condiciones?: string[];
  /**
   * Usar peso ajustado en vez de peso real. Nunca se activa solo: es una
   * decisión clínica del nutriólogo, aunque el IMC la sugiera.
   */
  usarPesoAjustado?: boolean;
};

function porcentajeDeKcal(gramos: number, kcalPorGramo: number, kcalTotales: number): number {
  return Math.round(((gramos * kcalPorGramo) / kcalTotales) * 100);
}

export function calcularTDEE(datos: DatosCalculo): CalculoNutricional {
  const { peso, altura, edad, genero, nivelActividad, objetivo } = datos;
  if (peso <= 0 || altura <= 0 || edad <= 0) {
    throw new Error('EXPEDIENTE_INCOMPLETO');
  }

  const advertencias: string[] = [];
  const ecuacion = datos.ecuacion ?? ECUACION_POR_DEFECTO;
  const valorImc = imc(peso, altura);

  let pesoUsado = peso;
  let pesoAjustadoAplicado = false;
  if (datos.usarPesoAjustado) {
    pesoUsado = pesoAjustado(peso, pesoIdeal(altura, genero).porImc);
    pesoAjustadoAplicado = true;
    if (!requierePesoAjustado(valorImc)) {
      advertencias.push(
        `Se aplicó peso ajustado con IMC ${valorImc}; suele reservarse para IMC de 30 en adelante.`,
      );
    }
  }

  // Katch-McArdle parte de la masa magra real: un peso ajustado la falsearía.
  const pesoParaEcuacion = ecuacion === 'katch_mcardle' ? peso : pesoUsado;
  if (pesoAjustadoAplicado && ecuacion === 'katch_mcardle') {
    advertencias.push(
      'Katch-McArdle se calculó con el peso real: la masa magra ya descuenta el tejido adiposo.',
    );
  }

  const bmr = calcularBmr(ecuacion, {
    peso: pesoParaEcuacion,
    altura,
    edad,
    genero,
    grasaPct: datos.grasaPct,
  });

  const factorActividad = factorDeActividad(nivelActividad);
  const tdee = Math.round(bmr * factorActividad);
  const ajusteObjetivo = AJUSTE_OBJETIVO[objetivo] ?? 0;
  const objetivoCalorias = Math.round(tdee * (1 + ajusteObjetivo));

  const proteina = requerimientoProteina({
    pesoKg: pesoUsado,
    objetivo,
    condiciones: datos.condiciones,
    gPorKg: datos.proteinaGPorKg,
  });
  const { pPct, cPct, gPct } = distribucionMacros(objetivo);

  let proteina_g: number;
  let carbos_g: number;
  let grasa_g: number;

  if (datos.modoProteina === 'g_por_kg') {
    advertencias.push(...proteina.advertencias);
    proteina_g = proteina.gramos;
    grasa_g = Math.round((objetivoCalorias * gPct) / KCAL_POR_G_GRASA);
    const kcalRestantes =
      objetivoCalorias - proteina_g * KCAL_POR_G_PROTEINA - grasa_g * KCAL_POR_G_GRASA;
    carbos_g = Math.max(0, Math.round(kcalRestantes / KCAL_POR_G_CARBO));
    if (kcalRestantes < 0) {
      advertencias.push(
        'La proteína y la grasa fijadas ya superan las calorías objetivo: los hidratos quedaron en cero.',
      );
    }
  } else {
    proteina_g = Math.round((objetivoCalorias * pPct) / KCAL_POR_G_PROTEINA);
    carbos_g = Math.round((objetivoCalorias * cPct) / KCAL_POR_G_CARBO);
    grasa_g = Math.round((objetivoCalorias * gPct) / KCAL_POR_G_GRASA);

    const gPorKgResultante = proteina_g / pesoUsado;
    if (gPorKgResultante > proteina.gPorKgMax) {
      advertencias.push(
        `El ${Math.round(pPct * 100)} % de proteína equivale a ${gPorKgResultante.toFixed(1)} g/kg, ` +
          `por encima del máximo de ${proteina.gPorKgMax} g/kg para este caso.`,
      );
    }
    if (proteina.limitadoPorCondicion) {
      advertencias.push(...proteina.advertencias);
    }
  }

  const agua = requerimientoAgua({ pesoKg: pesoUsado, edad, nivelActividad });

  return {
    ecuacion,
    bmr,
    tdee,
    objetivoCalorias,
    proteina_g,
    carbos_g,
    grasa_g,
    pPct: porcentajeDeKcal(proteina_g, KCAL_POR_G_PROTEINA, objetivoCalorias),
    cPct: porcentajeDeKcal(carbos_g, KCAL_POR_G_CARBO, objetivoCalorias),
    gPct: porcentajeDeKcal(grasa_g, KCAL_POR_G_GRASA, objetivoCalorias),
    pesoUsado,
    pesoAjustadoAplicado,
    factorActividad,
    ajusteObjetivo,
    proteinaGPorKg: Math.round((proteina_g / pesoUsado) * 100) / 100,
    aguaMl: agua.ml,
    advertencias,
  };
}
