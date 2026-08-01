import type { Mensaje, MensajeEnPantalla, RespuestaMensajes } from './types';

/**
 * Cálculos puros del hilo: orden, agrupación por día y la burbuja optimista.
 *
 * Fuera de los componentes porque aquí está lo que de verdad puede fallar —el
 * orden invertido que manda el servidor, el corte de día, el mensaje que aún no
 * se confirma— y eso se prueba mejor sin montar React.
 */

/** Prefijo de los ids optimistas; el servidor nunca emite uno así. */
const PREFIJO_OPTIMISTA = 'optimista-';

/**
 * Hilo en orden de lectura: el más viejo arriba.
 *
 * `listarMensajes` ordena `createdAt: 'desc'` porque, con un tope de 100, lo que
 * hay que conservar son los **últimos** mensajes, no los primeros. Un chat se
 * lee al revés, así que la inversión ocurre aquí y no en el servidor: cambiarlo
 * allá le daría al paciente los 100 mensajes más antiguos del hilo.
 */
export function ordenarMensajes(mensajes: Mensaje[]): MensajeEnPantalla[] {
  if (!Array.isArray(mensajes)) return [];
  return mensajes
    .filter((mensaje) => Boolean(mensaje?.id))
    .slice()
    .sort((a, b) => {
      const orden = a.created_at.localeCompare(b.created_at);
      // Dos mensajes en el mismo milisegundo mantienen un orden estable en vez
      // de bailar entre sondeos.
      return orden !== 0 ? orden : a.id.localeCompare(b.id);
    });
}

export type GrupoDeDia = {
  /** Día natural en local (`YYYY-MM-DD`), que es la clave del grupo. */
  dia: string;
  etiqueta: string;
  mensajes: MensajeEnPantalla[];
};

/**
 * Mensajes partidos por día, con su separador.
 *
 * El corte usa la fecha **local** del paciente: un mensaje de las 23:40 en
 * México pertenece a ese día, aunque en UTC ya sea el siguiente.
 */
export function agruparPorDia(mensajes: MensajeEnPantalla[], ahora = new Date()): GrupoDeDia[] {
  const grupos: GrupoDeDia[] = [];

  for (const mensaje of ordenarMensajes(mensajes)) {
    const fecha = new Date(mensaje.created_at);
    if (Number.isNaN(fecha.getTime())) continue;

    const dia = diaLocal(fecha);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === dia) {
      ultimo.mensajes.push(mensaje);
      continue;
    }
    grupos.push({ dia, etiqueta: etiquetaDeDia(fecha, ahora), mensajes: [mensaje] });
  }

  return grupos;
}

/** `YYYY-MM-DD` en la zona del teléfono, no en UTC. */
export function diaLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
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

/** "Hoy", "Ayer" o "3 jul": el separador que corta el hilo. */
export function etiquetaDeDia(fecha: Date, ahora = new Date()): string {
  const dia = diaLocal(fecha);
  if (dia === diaLocal(ahora)) return 'Hoy';

  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
  if (dia === diaLocal(ayer)) return 'Ayer';

  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}

/**
 * Hora del mensaje en formato de 24 h.
 *
 * Se arma a mano en vez de con `toLocaleTimeString`: el resultado no depende
 * de qué datos de ICU traiga el runtime, y "14:30" se lee igual en cualquier
 * teléfono.
 */
export function horaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(
    2,
    '0',
  )}`;
}

/** Burbuja que se pinta antes de que el servidor confirme. */
export function mensajeOptimista(texto: string, ahora = new Date()): MensajeEnPantalla {
  return {
    id: `${PREFIJO_OPTIMISTA}${ahora.getTime()}`,
    emisor: 'PATIENT',
    texto,
    leido_at: null,
    created_at: ahora.toISOString(),
    pendiente: true,
  };
}

export function esOptimista(mensaje: MensajeEnPantalla): boolean {
  return mensaje.id.startsWith(PREFIJO_OPTIMISTA);
}

/**
 * Agrega la burbuja optimista al sobre cacheado.
 *
 * `sin_leer` no se toca: cuenta los mensajes **del nutriólogo** que el paciente
 * no ha abierto, y escribir uno propio no cambia ese número.
 */
export function agregarOptimista(
  respuesta: RespuestaMensajes,
  mensaje: MensajeEnPantalla,
): RespuestaMensajes {
  return {
    ...respuesta,
    data: [mensaje, ...respuesta.data],
    meta: { ...respuesta.meta, total: respuesta.meta.total + 1 },
  };
}

/** Cuántos mensajes del nutriólogo siguen sin abrir. */
export function sinLeerDe(respuesta: RespuestaMensajes | undefined): number {
  const cuenta = respuesta?.meta?.sin_leer;
  return Number.isFinite(cuenta) && cuenta! > 0 ? Math.floor(cuenta!) : 0;
}
