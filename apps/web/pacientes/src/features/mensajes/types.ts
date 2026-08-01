/**
 * Contrato que la app del paciente lee de `/api/v1/me/messages`.
 *
 * El hilo es el **mismo** que ve el nutriólogo en su panel: una sola tabla
 * `messages`, no una copia. Por eso no hay campo de "simulación" ni un emisor
 * `ia`: lo que aparece aquí lo escribió una persona.
 */

/** Quién escribió. El servidor no acepta este campo al enviar: lo deduce de la sesión. */
export type EmisorMensaje = 'NUTRITIONIST' | 'PATIENT';

export type Mensaje = {
  id: string;
  emisor: EmisorMensaje;
  texto: string;
  /** `null` mientras el destinatario no lo haya abierto. */
  leido_at: string | null;
  created_at: string;
};

/**
 * Respuesta del hilo, con `sin_leer` en el `meta`.
 *
 * El conteo viaja aquí y no en un endpoint aparte para que la nav inferior
 * pinte su indicador sin una segunda petición.
 */
export type RespuestaMensajes = {
  data: Mensaje[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    sin_leer: number;
  };
};

/**
 * Mensaje en pantalla.
 *
 * `pendiente` marca la burbuja que ya se ve pero que el servidor todavía no
 * confirmó. No existe en el contrato: es estado de la UI, y por eso vive en un
 * tipo distinto al que llega por la red.
 */
export type MensajeEnPantalla = Mensaje & { pendiente?: boolean };
