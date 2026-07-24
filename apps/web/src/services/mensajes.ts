import { pedir } from '@/services/http';
import type { ListaPaginada } from '@/services/planes';

/** Cliente de mensajes. La V2 sondea con React Query; tiempo real es V2.1. */

export type EmisorMensaje = 'NUTRITIONIST' | 'PATIENT';

export type MensajeApi = {
  id: string;
  patient_id: string;
  emisor: EmisorMensaje;
  texto: string;
  leido_at: string | null;
  created_at: string;
};

export type ConversacionApi = {
  patient_id: string;
  paciente: { id: string; nombre: string; foto_url: string | null };
  ultimo_mensaje: {
    texto: string | null;
    emisor: EmisorMensaje | null;
    created_at: string;
  } | null;
  sin_leer: number;
};

export function listarConversaciones(): Promise<ListaPaginada<ConversacionApi>> {
  return pedir<ListaPaginada<ConversacionApi>>('/api/v1/conversations');
}

export function listarHilo(pacienteId: string): Promise<ListaPaginada<MensajeApi>> {
  return pedir<ListaPaginada<MensajeApi>>(
    `/api/v1/patients/${pacienteId}/messages?per_page=100`,
  );
}

export function enviarMensaje(pacienteId: string, texto: string): Promise<MensajeApi> {
  return pedir<MensajeApi>(`/api/v1/patients/${pacienteId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

export function marcarHiloLeido(pacienteId: string): Promise<{ marcados: number }> {
  return pedir<{ marcados: number }>(`/api/v1/patients/${pacienteId}/messages/read`, {
    method: 'POST',
  });
}
