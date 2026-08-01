import { json, pedir } from '@/lib/apiCliente';

import type { Mensaje, RespuestaMensajes } from './types';

/**
 * Lecturas y escrituras del hilo.
 *
 * `obtenerMensajes` devuelve el sobre completo, no solo `data`: el `sin_leer`
 * del `meta` es lo que alimenta el indicador de la nav inferior, y `pedirLista`
 * lo tiraría.
 *
 * Ninguna función acepta destinatario. El nutriólogo sale del expediente en el
 * servidor; si viajara en el cuerpo, existiría un campo que manipular para
 * escribirle a cualquier profesional de la plataforma.
 */

export function obtenerMensajes(): Promise<RespuestaMensajes> {
  return pedir<RespuestaMensajes>('/api/v1/me/messages');
}

export function enviarMensaje(texto: string): Promise<Mensaje> {
  return json<Mensaje>('/api/v1/me/messages', 'POST', { texto });
}

/** Marca leídos los del nutriólogo. Los propios no se marcan: no significaría nada. */
export function marcarLeidos(): Promise<{ marcados: number }> {
  return json<{ marcados: number }>('/api/v1/me/messages/read', 'POST', {});
}
