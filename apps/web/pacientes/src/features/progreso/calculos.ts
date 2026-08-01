import type { Logro, RegistroPeso, TendenciaPeso } from './types';

/**
 * Cálculos puros de la pantalla Progreso: geometría de la gráfica, formato de
 * kilos y lectura de los logros.
 *
 * Están fuera de los componentes porque son la parte con bordes —series de un
 * solo punto, pesos idénticos, fechas que cruzan el cambio de día— y esa es
 * justo la parte que conviene probar sin montar React.
 */

/**
 * Lienzo de la gráfica, en unidades del `viewBox`.
 *
 * No son píxeles: el SVG se estira al ancho de la tarjeta, así que estas
 * medidas solo fijan la proporción. Se declaran aquí para que la geometría se
 * pueda probar sin renderizar.
 */
export const GRAFICA = { ancho: 320, alto: 120, margen: 14 } as const;

export type PuntoGrafica = {
  x: number;
  y: number;
  peso: number;
  fecha: string;
};

export type GeometriaGrafica = {
  puntos: PuntoGrafica[];
  /** Path de la línea (`M … L …`). */
  linea: string;
  /** El mismo trazo cerrado contra la base, para el relleno degradado. */
  area: string;
  /** Extremos reales de la serie, para las etiquetas del eje. */
  pesoMinimo: number;
  pesoMaximo: number;
};

/** Pesajes utilizables, en orden cronológico. */
export function serieDePesos(pesos: RegistroPeso[]): RegistroPeso[] {
  if (!Array.isArray(pesos)) return [];
  return pesos
    .filter((registro) => Number.isFinite(registro?.peso_kg) && Boolean(registro?.fecha))
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Geometría de la línea de peso, o `null` si no hay dos pesajes.
 *
 * Con un solo punto no hay tendencia que dibujar, y una gráfica de un punto
 * insinúa una línea plana que nadie midió.
 */
export function geometriaDeGrafica(pesos: RegistroPeso[]): GeometriaGrafica | null {
  const serie = serieDePesos(pesos);
  if (serie.length < 2) return null;

  const { ancho, alto, margen } = GRAFICA;
  const valores = serie.map((registro) => registro.peso_kg);
  const pesoMinimo = Math.min(...valores);
  const pesoMaximo = Math.max(...valores);

  // Media res de holgura como mínimo: sin ella, una serie casi plana
  // (71.2 → 71.4) llenaría el alto del lienzo y se leería como un desplome.
  // También garantiza que el rango nunca sea cero y no haya división por cero.
  const holgura = Math.max(0.5, (pesoMaximo - pesoMinimo) * 0.15);
  const minimo = pesoMinimo - holgura;
  const rango = pesoMaximo + holgura - minimo;

  const utilAncho = ancho - margen * 2;
  const utilAlto = alto - margen * 2;

  const puntos = serie.map((registro, indice) => ({
    x: redondear(margen + (indice / (serie.length - 1)) * utilAncho),
    y: redondear(alto - margen - ((registro.peso_kg - minimo) / rango) * utilAlto),
    peso: registro.peso_kg,
    fecha: registro.fecha,
  }));

  const linea = puntos.map((punto, i) => `${i === 0 ? 'M' : 'L'}${punto.x},${punto.y}`).join(' ');
  const primero = puntos[0]!;
  const ultimo = puntos[puntos.length - 1]!;
  const area = `${linea} L${ultimo.x},${alto - margen} L${primero.x},${alto - margen} Z`;

  return { puntos, linea, area, pesoMinimo, pesoMaximo };
}

/** Dos decimales bastan para coordenadas; evita paths de 200 caracteres. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export type CambioPeso = {
  direccion: 'baja' | 'sube' | 'igual';
  /** Magnitud del cambio, siempre positiva. El signo lo dice `direccion`. */
  kg: number;
  etiqueta: string;
};

/**
 * Cambio desde el primer pesaje, con su dirección.
 *
 * La tarjeta no se titula "Perdido" a secas: un paciente con objetivo de ganar
 * masa vería "Perdido −2 kg" al cumplir su meta, que es exactamente lo
 * contrario de lo que logró. El servidor manda `cambio_kg` con signo (negativo
 * = bajó) y aquí se traduce a palabras en vez de asumir la dirección.
 */
export function cambioDePeso(peso: TendenciaPeso | null): CambioPeso | null {
  if (!peso || !Number.isFinite(peso.cambio_kg)) return null;

  const kg = Math.abs(Math.round(peso.cambio_kg * 10) / 10);
  if (kg === 0) return { direccion: 'igual', kg: 0, etiqueta: 'Sin cambio' };
  return peso.cambio_kg < 0
    ? { direccion: 'baja', kg, etiqueta: 'Perdido' }
    : { direccion: 'sube', kg, etiqueta: 'Ganado' };
}

/** Kilos legibles: `72` en vez de `72.0`, `72.5` cuando la décima importa. */
export function formatearKg(valor: number): string {
  if (!Number.isFinite(valor)) return '—';
  return String(Number(valor.toFixed(1)));
}

/** El avance (0 a 1) como entero acotado, que es lo que la barra necesita. */
export function porcentajeDeLogro(progreso: number): number {
  if (!Number.isFinite(progreso)) return 0;
  return Math.min(100, Math.max(0, Math.round(progreso * 100)));
}

/** Cuántos logros lleva, para el encabezado de la sección. */
export function conteoDeLogros(logros: Logro[]): { conseguidos: number; total: number } {
  if (!Array.isArray(logros)) return { conseguidos: 0, total: 0 };
  return {
    conseguidos: logros.filter((logro) => logro.conseguido).length,
    total: logros.length,
  };
}

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

/**
 * `2026-07-03` → `3 jul`.
 *
 * Se parte la cadena a mano en vez de usar `new Date(iso).toLocaleDateString()`:
 * esa forma interpreta `YYYY-MM-DD` como medianoche **UTC**, y en México
 * (UTC−6) el 3 de julio se pintaría como 2 de julio. El campo ya es un día
 * natural resuelto en la zona del paciente; volver a moverlo solo lo estropea.
 */
export function fechaCorta(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!partes) return '';
  const mes = MESES[Number(partes[2]) - 1];
  return mes ? `${Number(partes[3])} ${mes}` : '';
}
