/**
 * Utilidades de fecha *civil* (`YYYY-MM-DD`), sin hora ni zona horaria.
 *
 * El seguimiento razona en días naturales del paciente: "registró algo el
 * martes". Operar eso con `Date` obliga a elegir una zona horaria, y en un
 * servidor en UTC un registro de las 20:00 en Ciudad de México cae al día
 * siguiente. Por eso el día se trata como texto y solo se convierte a `Date`
 * en la frontera con la base de datos.
 */

export type FechaIso = string;

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Verificación por ida y vuelta: `Date.parse('2026-02-30')` no falla, desborda
 * al 2 de marzo. Comparar el texto original contra el que produce la fecha
 * interpretada es lo único que descarta un día que no existe.
 */
export function esFechaIso(valor: unknown): valor is FechaIso {
  if (typeof valor !== 'string' || !FORMATO.test(valor)) return false;
  const interpretada = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(interpretada.getTime()) && interpretada.toISOString().slice(0, 10) === valor;
}

function aUtc(fecha: FechaIso): number {
  return Date.parse(`${fecha}T00:00:00Z`);
}

function desdeUtc(ms: number): FechaIso {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Día civil de un instante en la zona indicada.
 *
 * `timeZone` es obligatorio: tomar la del servidor haría que el mismo registro
 * cayera en días distintos según dónde corra el proceso.
 */
export function fechaIsoEnZona(instante: Date, timeZone: string): FechaIso {
  // `en-CA` produce directamente `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

export function sumarDias(fecha: FechaIso, dias: number): FechaIso {
  return desdeUtc(aUtc(fecha) + dias * MS_POR_DIA);
}

/** Días completos de `desde` a `hasta`; negativo si `hasta` es anterior. */
export function diferenciaEnDias(desde: FechaIso, hasta: FechaIso): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA);
}

/** Lista inclusiva de días. Devuelve vacío si el rango está invertido. */
export function rangoDeDias(desde: FechaIso, hasta: FechaIso): FechaIso[] {
  const total = diferenciaEnDias(desde, hasta);
  if (total < 0) return [];
  return Array.from({ length: total + 1 }, (_, i) => sumarDias(desde, i));
}

export function fechaMinima(a: FechaIso, b: FechaIso): FechaIso {
  return a <= b ? a : b;
}

export function fechaMaxima(a: FechaIso, b: FechaIso): FechaIso {
  return a >= b ? a : b;
}
