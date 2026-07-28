import { pedir } from '@/services/http';
import type { ListaPaginada } from '@/services/planes';

/** Cliente de `/api/v1/appointments`. Ningún componente llama a `fetch`. */

export type TipoCita = 'PRESENCIAL' | 'VIDEOLLAMADA';
export type EstadoCita = 'PROGRAMADA' | 'COMPLETADA' | 'CANCELADA' | 'NO_ASISTIO';

export type CitaApi = {
  id: string;
  patient_id: string;
  paciente: { id: string; nombre: string; foto_url: string | null };
  /** Instante en ISO 8601 UTC; la UI lo formatea en la zona del consultorio. */
  inicio: string;
  duracion_min: number;
  tipo: TipoCita;
  estado: EstadoCita;
  notas: string | null;
  video_url: string | null;
  recordatorio_enviado_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CrearCitaPayload = {
  patient_id: string;
  inicio: string;
  duracion_min?: number;
  tipo?: TipoCita;
  notas?: string | null;
  video_url?: string | null;
};

export type ActualizarCitaPayload = Partial<Omit<CrearCitaPayload, 'patient_id'>> & {
  estado?: EstadoCita;
};

export type FiltroCitas = {
  estado?: EstadoCita;
  patient_id?: string;
  desde?: string;
  hasta?: string;
};

export function listarCitas(filtros: FiltroCitas = {}): Promise<ListaPaginada<CitaApi>> {
  const params = new URLSearchParams({ per_page: '100' });
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) params.set(clave, valor);
  }
  return pedir<ListaPaginada<CitaApi>>(`/api/v1/appointments?${params.toString()}`);
}

export function crearCita(payload: CrearCitaPayload): Promise<CitaApi> {
  return pedir<CitaApi>('/api/v1/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarCita(id: string, payload: ActualizarCitaPayload): Promise<CitaApi> {
  return pedir<CitaApi>(`/api/v1/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function cancelarCita(id: string): Promise<CitaApi> {
  return pedir<CitaApi>(`/api/v1/appointments/${id}/cancel`, { method: 'POST' });
}

export function completarCita(id: string): Promise<CitaApi> {
  return pedir<CitaApi>(`/api/v1/appointments/${id}/complete`, { method: 'POST' });
}

export function marcarInasistencia(id: string): Promise<CitaApi> {
  return pedir<CitaApi>(`/api/v1/appointments/${id}/no_show`, { method: 'POST' });
}

export function eliminarCita(id: string): Promise<void> {
  return pedir<void>(`/api/v1/appointments/${id}`, { method: 'DELETE' });
}
