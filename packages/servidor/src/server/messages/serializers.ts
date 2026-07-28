import type { Message } from '@prisma/client';

export function serializarMensaje(mensaje: Message) {
  return {
    id: mensaje.id,
    patient_id: mensaje.patientId,
    emisor: mensaje.emisor,
    texto: mensaje.texto,
    leido_at: mensaje.leidoAt?.toISOString() ?? null,
    created_at: mensaje.createdAt.toISOString(),
  };
}

export type ConversacionCruda = {
  patientId: string;
  nombre: string;
  fotoUrl: string | null;
  ultimoTexto: string | null;
  ultimoEmisor: 'NUTRITIONIST' | 'PATIENT' | null;
  ultimoAt: Date | null;
  sinLeer: number;
};

/** Fila de la bandeja: paciente + última línea + pendientes por leer. */
export function serializarConversacion(conversacion: ConversacionCruda) {
  return {
    patient_id: conversacion.patientId,
    paciente: {
      id: conversacion.patientId,
      nombre: conversacion.nombre,
      foto_url: conversacion.fotoUrl,
    },
    ultimo_mensaje: conversacion.ultimoAt
      ? {
          texto: conversacion.ultimoTexto,
          emisor: conversacion.ultimoEmisor,
          created_at: conversacion.ultimoAt.toISOString(),
        }
      : null,
    sin_leer: conversacion.sinLeer,
  };
}

export type MensajeSerializado = ReturnType<typeof serializarMensaje>;
export type ConversacionSerializada = ReturnType<typeof serializarConversacion>;
