import type { Genero, NivelActividad, Objetivo } from './types';

/**
 * Traducción entre los códigos que guarda PostgreSQL y las etiquetas que lee el
 * nutriólogo. La base no puede guardar acentos ni espacios en un enum, y la UI
 * no debe mostrar `PERDIDA_DE_GRASA`.
 *
 * Los mapas inversos se derivan de los directos: así no pueden quedar desfasados.
 */

export type GeneroDb = 'FEMENINO' | 'MASCULINO' | 'OTRO';
export type NivelActividadDb =
  | 'SEDENTARIO'
  | 'LIGERO'
  | 'MODERADO'
  | 'ACTIVO'
  | 'MUY_ACTIVO';
export type ObjetivoDb =
  | 'PERDIDA_DE_GRASA'
  | 'GANANCIA_MUSCULAR'
  | 'MANTENIMIENTO'
  | 'CONTROL_DE_DIABETES'
  | 'MEJORA_DEPORTIVA'
  | 'OTRO';

const GENERO_A_DB: Record<Genero, GeneroDb> = {
  Femenino: 'FEMENINO',
  Masculino: 'MASCULINO',
  Otro: 'OTRO',
};

const NIVEL_ACTIVIDAD_A_DB: Record<NivelActividad, NivelActividadDb> = {
  Sedentario: 'SEDENTARIO',
  Ligero: 'LIGERO',
  Moderado: 'MODERADO',
  Activo: 'ACTIVO',
  'Muy activo': 'MUY_ACTIVO',
};

const OBJETIVO_A_DB: Record<Objetivo, ObjetivoDb> = {
  'Pérdida de grasa': 'PERDIDA_DE_GRASA',
  'Ganancia muscular': 'GANANCIA_MUSCULAR',
  Mantenimiento: 'MANTENIMIENTO',
  'Control de diabetes': 'CONTROL_DE_DIABETES',
  'Mejora deportiva': 'MEJORA_DEPORTIVA',
  Otro: 'OTRO',
};

function invertir<Etiqueta extends string, Codigo extends string>(
  mapa: Record<Etiqueta, Codigo>,
): Record<Codigo, Etiqueta> {
  const salida = {} as Record<Codigo, Etiqueta>;
  for (const [etiqueta, codigo] of Object.entries(mapa) as [Etiqueta, Codigo][]) {
    salida[codigo] = etiqueta;
  }
  return salida;
}

const GENERO_DESDE_DB = invertir(GENERO_A_DB);
const NIVEL_ACTIVIDAD_DESDE_DB = invertir(NIVEL_ACTIVIDAD_A_DB);
const OBJETIVO_DESDE_DB = invertir(OBJETIVO_A_DB);

export function generoADb(valor: Genero): GeneroDb {
  return GENERO_A_DB[valor] ?? 'OTRO';
}

export function generoDesdeDb(valor: GeneroDb): Genero {
  return GENERO_DESDE_DB[valor] ?? 'Otro';
}

export function nivelActividadADb(valor: NivelActividad): NivelActividadDb {
  return NIVEL_ACTIVIDAD_A_DB[valor] ?? 'MODERADO';
}

export function nivelActividadDesdeDb(valor: NivelActividadDb): NivelActividad {
  return NIVEL_ACTIVIDAD_DESDE_DB[valor] ?? 'Moderado';
}

export function objetivoADb(valor: Objetivo): ObjetivoDb {
  return OBJETIVO_A_DB[valor] ?? 'OTRO';
}

export function objetivoDesdeDb(valor: ObjetivoDb): Objetivo {
  return OBJETIVO_DESDE_DB[valor] ?? 'Otro';
}

/** Listas para poblar los `select` del formulario sin repetir literales. */
export const GENEROS_DB = Object.values(GENERO_A_DB);
export const NIVELES_ACTIVIDAD_DB = Object.values(NIVEL_ACTIVIDAD_A_DB);
export const OBJETIVOS_DB = Object.values(OBJETIVO_A_DB);

const MS_POR_ANIO = 365.2425 * 24 * 60 * 60 * 1000;

/**
 * El expediente guarda fecha de nacimiento, no edad: una edad almacenada queda
 * obsoleta al día siguiente del cumpleaños y descuadraría el cálculo de TDEE.
 * Devuelve 0 si la fecha falta o es futura, para que las fórmulas lancen
 * EXPEDIENTE_INCOMPLETO en vez de calcular sobre un dato inventado.
 */
export function edadDesdeFechaNacimiento(
  fechaNacimiento: string | Date | null | undefined,
  hoy: Date = new Date(),
): number {
  if (!fechaNacimiento) return 0;
  const nacimiento = new Date(fechaNacimiento);
  if (Number.isNaN(nacimiento.getTime())) return 0;
  const transcurrido = hoy.getTime() - nacimiento.getTime();
  if (transcurrido < 0) return 0;
  return Math.floor(transcurrido / MS_POR_ANIO);
}

/** Fecha de nacimiento aproximada a partir de la edad que captura el nutriólogo. */
export function fechaNacimientoDesdeEdad(edad: number, hoy: Date = new Date()): string | null {
  if (!Number.isFinite(edad) || edad <= 0 || edad > 120) return null;
  const fecha = new Date(hoy.getTime() - edad * MS_POR_ANIO);
  return fecha.toISOString().slice(0, 10);
}
