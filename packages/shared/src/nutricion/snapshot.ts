import type { CalculoNutricional, Genero, NivelActividad, Objetivo, Pliegues } from '../types';

import {
  type ClasificacionImc,
  type IndiceConRiesgo,
  type PesoIdeal,
  type ResultadoGrasaCorporal,
  clasificarImc,
  grasaCorporalDurninWomersley,
  imc,
  indiceCinturaCadera,
  indiceCinturaTalla,
  pesoAjustado,
  pesoIdeal,
  requierePesoAjustado,
} from './antropometria';
import { type DatosCalculo, calcularTDEE } from './calculo';
import { type ComparativaEcuacion, compararEcuaciones } from './energia';
import {
  type DistribucionEquivalentes,
  type GrupoSmae,
  distribuirEquivalentes,
} from './equivalentes';

/**
 * Snapshot del cálculo: lo que se guarda en el plan para poder auditarlo.
 *
 * Guardar solo las kcal resultantes no basta — meses después nadie podría decir
 * con qué peso, qué ecuación y qué ajustes se llegó a ese número, y el
 * expediente clínico exige poder reconstruirlo (NOM-004-SSA3). Por eso el
 * snapshot lleva entradas y resultado juntos, y se versiona.
 */

export const VERSION_SNAPSHOT = 1;

export type OrigenGrasaCorporal = 'medido' | 'pliegues';

export type ResumenAntropometrico = {
  imc: number;
  clasificacion: ClasificacionImc;
  cinturaCadera: IndiceConRiesgo | null;
  cinturaTalla: IndiceConRiesgo | null;
  grasa: (ResultadoGrasaCorporal & { origen: OrigenGrasaCorporal }) | null;
  pesoIdeal: PesoIdeal;
  pesoAjustado: number;
  requierePesoAjustado: boolean;
};

export type DatosSnapshot = DatosCalculo & {
  cintura?: number;
  cadera?: number;
  pliegues?: Pliegues | null;
  minimosEquivalentes?: Partial<Record<GrupoSmae, number>>;
};

export type SnapshotCalculo = {
  version: number;
  calculadoEn: string;
  entradas: {
    peso: number;
    altura: number;
    edad: number;
    genero: Genero;
    nivelActividad: NivelActividad;
    objetivo: Objetivo;
    condiciones: string[];
    cintura: number | null;
    cadera: number | null;
    pliegues: Pliegues | null;
    grasaPct: number | null;
    usarPesoAjustado: boolean;
    modoProteina: NonNullable<DatosCalculo['modoProteina']>;
    proteinaGPorKg: number | null;
  };
  resultado: CalculoNutricional;
  antropometria: ResumenAntropometrico;
  comparativa: ComparativaEcuacion[];
  equivalentes: DistribucionEquivalentes;
};

function positivo(valor: number | undefined | null): number | null {
  return typeof valor === 'number' && valor > 0 ? valor : null;
}

/** Los cuatro pliegues son obligatorios para Durnin-Womersley. */
function plieguesCompletos(pliegues: Pliegues | null | undefined): pliegues is Required<Pliegues> {
  if (!pliegues) return false;
  return [
    pliegues.tricipital,
    pliegues.bicipital,
    pliegues.subescapular,
    pliegues.suprailiaco,
  ].every((valor) => typeof valor === 'number' && valor > 0);
}

function resumirAntropometria(
  datos: DatosSnapshot,
  grasa: (ResultadoGrasaCorporal & { origen: OrigenGrasaCorporal }) | null,
): ResumenAntropometrico {
  const { peso, altura, genero } = datos;
  const valorImc = imc(peso, altura);
  const ideal = pesoIdeal(altura, genero);
  const cintura = positivo(datos.cintura);
  const cadera = positivo(datos.cadera);

  return {
    imc: valorImc,
    clasificacion: clasificarImc(valorImc, { alturaCm: altura, genero }),
    cinturaCadera: cintura && cadera ? indiceCinturaCadera(cintura, cadera, genero) : null,
    cinturaTalla: cintura ? indiceCinturaTalla(cintura, altura) : null,
    grasa,
    pesoIdeal: ideal,
    pesoAjustado: pesoAjustado(peso, ideal.porImc),
    requierePesoAjustado: requierePesoAjustado(valorImc),
  };
}

/**
 * Ejecuta el cálculo completo (energía, antropometría, comparativa de
 * ecuaciones y equivalentes SMAE) y lo devuelve listo para persistir.
 *
 * Si hay pliegues completos y no hay `grasaPct` capturado, el % de grasa se
 * deriva de ellos: no es un dato inventado sino la medición del propio
 * plicómetro, y queda marcado con su origen.
 */
export function construirSnapshotCalculo(datos: DatosSnapshot, ahora = new Date()): SnapshotCalculo {
  const grasaMedida = positivo(datos.grasaPct);
  const porPliegues = plieguesCompletos(datos.pliegues)
    ? grasaCorporalDurninWomersley(datos.pliegues, datos.edad, datos.genero, datos.peso)
    : null;

  const grasa: (ResultadoGrasaCorporal & { origen: OrigenGrasaCorporal }) | null = grasaMedida
    ? {
        ...(porPliegues ?? {
          densidadCorporal: 0,
          sumaPliegues: 0,
          masaGrasaKg: Math.round(((datos.peso * grasaMedida) / 100) * 10) / 10,
          masaMagraKg: Math.round((datos.peso * (1 - grasaMedida / 100)) * 10) / 10,
        }),
        grasaPct: grasaMedida,
        origen: 'medido',
      }
    : porPliegues
      ? { ...porPliegues, origen: 'pliegues' }
      : null;

  const grasaPct = grasa?.grasaPct;
  const resultado = calcularTDEE({ ...datos, grasaPct });

  const equivalentes = distribuirEquivalentes(
    {
      kcal: resultado.objetivoCalorias,
      proteina_g: resultado.proteina_g,
      carbos_g: resultado.carbos_g,
      grasa_g: resultado.grasa_g,
    },
    { minimos: datos.minimosEquivalentes },
  );

  return {
    version: VERSION_SNAPSHOT,
    calculadoEn: ahora.toISOString(),
    entradas: {
      peso: datos.peso,
      altura: datos.altura,
      edad: datos.edad,
      genero: datos.genero,
      nivelActividad: datos.nivelActividad,
      objetivo: datos.objetivo,
      condiciones: datos.condiciones ?? [],
      cintura: positivo(datos.cintura),
      cadera: positivo(datos.cadera),
      pliegues: datos.pliegues ?? null,
      grasaPct: grasaPct ?? null,
      usarPesoAjustado: Boolean(datos.usarPesoAjustado),
      modoProteina: datos.modoProteina ?? 'porcentaje',
      proteinaGPorKg: positivo(datos.proteinaGPorKg),
    },
    resultado,
    antropometria: resumirAntropometria(datos, grasa),
    comparativa: compararEcuaciones(
      {
        peso: datos.usarPesoAjustado ? resultado.pesoUsado : datos.peso,
        altura: datos.altura,
        edad: datos.edad,
        genero: datos.genero,
        grasaPct,
      },
      datos.nivelActividad,
    ),
    equivalentes,
  };
}
