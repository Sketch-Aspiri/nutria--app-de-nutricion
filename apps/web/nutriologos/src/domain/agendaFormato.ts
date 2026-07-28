import type { EstadoCita, TipoCita } from '@/services/agenda';

/**
 * Formato de la agenda para la UI.
 *
 * Las citas viajan como instantes ISO en UTC; el navegador del nutriólogo las
 * presenta en su propia zona, que es la del consultorio. Por eso aquí no se
 * fuerza `timeZone`: hacerlo mostraría una hora distinta a la del reloj que
 * el nutriólogo tiene enfrente.
 */

const HORA = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });
const DIA_LARGO = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const DIA_CORTO = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: '2-digit' });

export function horaDeCita(iso: string): string {
  return HORA.format(new Date(iso));
}

export function diaCortoDeCita(iso: string): string {
  return DIA_CORTO.format(new Date(iso));
}

export function diaLargoDeCita(iso: string): string {
  return DIA_LARGO.format(new Date(iso));
}

/** Clave de agrupación por día natural, en la zona del navegador. */
export function claveDeDia(iso: string): string {
  const fecha = new Date(iso);
  const mes = `${fecha.getMonth() + 1}`.padStart(2, '0');
  const dia = `${fecha.getDate()}`.padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Convierte los campos `date` y `time` del formulario a un instante ISO.
 *
 * El navegador interpreta "2026-08-01T09:00" en su zona local y `toISOString`
 * lo lleva a UTC con el desplazamiento ya aplicado, que es justo lo que el
 * servidor exige.
 */
export function aInstanteIso(fecha: string, hora: string): string | null {
  const instante = new Date(`${fecha}T${hora}`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/** Separa un instante ISO en los valores que esperan los inputs del formulario. */
export function aCamposDeFormulario(iso: string): { fecha: string; hora: string } {
  const instante = new Date(iso);
  const mes = `${instante.getMonth() + 1}`.padStart(2, '0');
  const dia = `${instante.getDate()}`.padStart(2, '0');
  const horas = `${instante.getHours()}`.padStart(2, '0');
  const minutos = `${instante.getMinutes()}`.padStart(2, '0');
  return {
    fecha: `${instante.getFullYear()}-${mes}-${dia}`,
    hora: `${horas}:${minutos}`,
  };
}

export const ETIQUETA_ESTADO_CITA: Record<EstadoCita, string> = {
  PROGRAMADA: 'Programada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export const ETIQUETA_TIPO_CITA: Record<TipoCita, string> = {
  PRESENCIAL: 'Presencial',
  VIDEOLLAMADA: 'Videollamada',
};

export const CLASE_ESTADO_CITA: Record<EstadoCita, string> = {
  PROGRAMADA: 'text-emerald-700 border-emerald-200 bg-emerald-50',
  COMPLETADA: 'text-stone-600 border-stone-200 bg-stone-50',
  CANCELADA: 'text-orange-700 border-orange-200 bg-orange-50',
  NO_ASISTIO: 'text-orange-700 border-orange-200 bg-orange-50',
};
