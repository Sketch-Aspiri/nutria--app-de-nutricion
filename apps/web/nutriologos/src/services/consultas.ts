import { pedir } from './http';

export type NotaClinicaApi = {
  id: string;
  patient_id: string;
  fecha: string;
  motivo: string;
  hallazgos: string;
  plan: string;
  seguimiento: string;
  origen: 'MANUAL' | 'IA';
  firmada_at: string | null;
  created_at: string;
};

type ListaNotas = {
  data: NotaClinicaApi[];
  meta: { page: number; per_page: number; total: number };
};

export type NuevaNotaClinica = Pick<
  NotaClinicaApi,
  'motivo' | 'hallazgos' | 'plan' | 'seguimiento' | 'origen'
> & { firmar?: boolean };

export function listarNotasClinicas(patientId: string): Promise<ListaNotas> {
  return pedir<ListaNotas>(
    `/api/v1/patients/${patientId}/consultation_notes?per_page=100`,
  );
}

export function crearNotaClinica(
  patientId: string,
  input: NuevaNotaClinica,
): Promise<NotaClinicaApi> {
  return pedir<NotaClinicaApi>(
    `/api/v1/patients/${patientId}/consultation_notes`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function firmarNotaClinica(
  patientId: string,
  noteId: string,
): Promise<NotaClinicaApi> {
  return pedir<NotaClinicaApi>(
    `/api/v1/patients/${patientId}/consultation_notes/${noteId}/sign`,
    { method: 'POST' },
  );
}
