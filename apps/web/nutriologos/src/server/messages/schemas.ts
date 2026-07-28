import { z } from 'zod';

/** Un mensaje de chat, no un documento: el tope evita pegar un expediente entero. */
export const MAX_LARGO_MENSAJE = 4_000;

export const enviarMensajeSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, 'Escribe un mensaje antes de enviarlo.')
    .max(MAX_LARGO_MENSAJE, 'El mensaje es demasiado largo.'),
});

export const filtroMensajesSchema = z.object({
  /**
   * Sondeo incremental: el cliente pide solo lo posterior al último mensaje
   * que ya tiene, en vez de recargar el hilo completo cada 15 segundos.
   */
  desde_id: z.string().uuid('El identificador no es válido.').optional(),
});

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
export type FiltroMensajesInput = z.infer<typeof filtroMensajesSchema>;
