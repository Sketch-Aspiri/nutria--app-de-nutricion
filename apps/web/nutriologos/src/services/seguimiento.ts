import { pedir } from '@/services/http';
import type { ListaPaginada } from '@/services/planes';

/** Cliente del seguimiento: logs del paciente, adherencia y plan de actividad. */

export type ComidaRegistradaApi = {
  id: string;
  patient_id: string;
  meal_plan_meal_id: string | null;
  fecha: string;
  /** Día civil ya resuelto en la zona del consultorio. */
  dia: string;
  nombre: string;
  foto_url: string | null;
  comentario_paciente: string | null;
  comentario_nutriologo: string | null;
  created_at: string;
};

export type PesoRegistradoApi = {
  id: string;
  patient_id: string;
  fecha: string;
  peso_kg: number;
  created_at: string;
};

export type EjercicioRegistradoApi = {
  id: string;
  patient_id: string;
  fecha: string;
  tipo: string;
  duracion_min: number;
  created_at: string;
};

export type AdherenciaApi = {
  /** `null` cuando el paciente no tiene plan activo contra el cual medir. */
  adherencia: number | null;
  racha: number;
  dias_evaluados: number;
  dias_con_registro: number;
  comidas_registradas: number;
  comidas_esperadas: number;
  comidas_por_dia: number | null;
  plan_activo_desde: string | null;
  desglose: Array<{ fecha: string; registradas: number; esperadas: number }>;
  peso: { inicial_kg: number; actual_kg: number; cambio_kg: number } | null;
  zona_horaria: string;
};

export type PlanActividadApi = {
  id: string;
  patient_id: string;
  texto: string;
  origen: 'MANUAL' | 'IA';
  compartido_at: string | null;
  created_at: string;
  updated_at: string;
};

export function listarComidas(
  pacienteId: string,
): Promise<ListaPaginada<ComidaRegistradaApi>> {
  return pedir<ListaPaginada<ComidaRegistradaApi>>(
    `/api/v1/patients/${pacienteId}/meal_logs?per_page=100`,
  );
}

export function comentarComida(
  comidaId: string,
  comentario: string | null,
): Promise<ComidaRegistradaApi> {
  return pedir<ComidaRegistradaApi>(`/api/v1/meal_logs/${comidaId}`, {
    method: 'PATCH',
    body: JSON.stringify({ comentario_nutriologo: comentario }),
  });
}

export function listarEjercicio(
  pacienteId: string,
): Promise<ListaPaginada<EjercicioRegistradoApi>> {
  return pedir<ListaPaginada<EjercicioRegistradoApi>>(
    `/api/v1/patients/${pacienteId}/exercise_logs`,
  );
}

export function listarPesos(pacienteId: string): Promise<ListaPaginada<PesoRegistradoApi>> {
  return pedir<ListaPaginada<PesoRegistradoApi>>(`/api/v1/patients/${pacienteId}/weight_logs`);
}

export function registrarPeso(
  pacienteId: string,
  payload: { fecha: string; peso_kg: number },
): Promise<PesoRegistradoApi> {
  return pedir<PesoRegistradoApi>(`/api/v1/patients/${pacienteId}/weight_logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function obtenerAdherencia(pacienteId: string, dias = 7): Promise<AdherenciaApi> {
  return pedir<AdherenciaApi>(`/api/v1/patients/${pacienteId}/adherence?dias=${dias}`);
}

export function obtenerPlanActividad(pacienteId: string): Promise<PlanActividadApi | null> {
  return pedir<PlanActividadApi | null>(`/api/v1/patients/${pacienteId}/activity_plan`);
}

export function guardarPlanActividad(
  pacienteId: string,
  payload: { texto: string; origen?: 'MANUAL' | 'IA' },
): Promise<PlanActividadApi> {
  return pedir<PlanActividadApi>(`/api/v1/patients/${pacienteId}/activity_plan`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function compartirPlanActividad(planId: string): Promise<PlanActividadApi> {
  return pedir<PlanActividadApi>(`/api/v1/activity_plans/${planId}/share`, { method: 'POST' });
}
