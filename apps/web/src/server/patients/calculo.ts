import type {
  AnthropometryMeasurement,
  MedicalRecord,
  Patient,
} from '@prisma/client';

import {
  type DatosSnapshot,
  type Pliegues,
  type SnapshotCalculo,
  construirSnapshotCalculo,
  edadDesdeFechaNacimiento,
  generoDesdeDb,
  nivelActividadDesdeDb,
  objetivoDesdeDb,
} from '@nutria/shared';

import type { CalculoInput } from './schemas';

/**
 * Traduce el expediente guardado en PostgreSQL a la entrada de las fórmulas de
 * `packages/shared` y ejecuta el cálculo.
 *
 * El servidor recalcula siempre a partir de la base: el cliente elige la
 * ecuación y los ajustes, nunca envía los números. Un snapshot construido con
 * cifras del navegador no sería auditable.
 */

export type PacienteParaCalculo = Patient & {
  medicalRecord: MedicalRecord | null;
  measurements: AnthropometryMeasurement[];
};

/** Las columnas Json llegan como `unknown`: se filtra a los cuatro pliegues numéricos. */
function comoPliegues(valor: unknown): Pliegues | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const origen = valor as Record<string, unknown>;
  const claves = ['tricipital', 'bicipital', 'subescapular', 'suprailiaco'] as const;

  const pliegues: Pliegues = {};
  for (const clave of claves) {
    const medida = origen[clave];
    if (typeof medida === 'number' && medida > 0) pliegues[clave] = medida;
  }
  return Object.keys(pliegues).length > 0 ? pliegues : null;
}

function comoCondiciones(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

/**
 * Altura y % de grasa se toman de la medición más reciente que los tenga: en
 * consulta se pesa cada visita, pero la talla se mide una vez y la plicometría
 * cada varios meses.
 */
function ultimoValor(
  mediciones: AnthropometryMeasurement[],
  leer: (medicion: AnthropometryMeasurement) => number | null,
): number | undefined {
  for (const medicion of mediciones) {
    const valor = leer(medicion);
    if (typeof valor === 'number' && valor > 0) return valor;
  }
  return undefined;
}

function ultimosPliegues(mediciones: AnthropometryMeasurement[]): Pliegues | null {
  for (const medicion of mediciones) {
    const pliegues = comoPliegues(medicion.pliegues);
    if (pliegues) return pliegues;
  }
  return null;
}

/**
 * Construye la entrada de las fórmulas. `mediciones` debe venir ordenada de la
 * más reciente a la más antigua (es como las devuelve el repositorio).
 */
export function datosDeCalculo(
  paciente: PacienteParaCalculo,
  opciones: CalculoInput,
): DatosSnapshot {
  const expediente = paciente.medicalRecord;
  const mediciones = paciente.measurements;

  return {
    peso: ultimoValor(mediciones, (m) => m.pesoKg) ?? 0,
    altura: ultimoValor(mediciones, (m) => m.alturaCm) ?? 0,
    edad: edadDesdeFechaNacimiento(paciente.fechaNacimiento),
    genero: generoDesdeDb(paciente.genero),
    nivelActividad: nivelActividadDesdeDb(expediente?.nivelActividad ?? 'MODERADO'),
    objetivo: objetivoDesdeDb(expediente?.objetivo ?? 'MANTENIMIENTO'),
    condiciones: comoCondiciones(expediente?.condiciones),
    cintura: ultimoValor(mediciones, (m) => m.cinturaCm),
    cadera: ultimoValor(mediciones, (m) => m.caderaCm),
    grasaPct: ultimoValor(mediciones, (m) => m.grasaPct),
    pliegues: ultimosPliegues(mediciones),
    ecuacion: opciones.ecuacion,
    modoProteina: opciones.modo_proteina,
    proteinaGPorKg: opciones.proteina_g_por_kg ?? undefined,
    usarPesoAjustado: opciones.usar_peso_ajustado,
    minimosEquivalentes: opciones.minimos_equivalentes,
  };
}

/** Lanza `EXPEDIENTE_INCOMPLETO` si faltan peso, altura o fecha de nacimiento. */
export function calcularParaPaciente(
  paciente: PacienteParaCalculo,
  opciones: CalculoInput,
): SnapshotCalculo {
  return construirSnapshotCalculo(datosDeCalculo(paciente, opciones));
}
