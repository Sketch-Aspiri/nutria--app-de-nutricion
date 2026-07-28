import type { AlimentoFicha, ObjetivoDb } from '@nutria/shared';

import { ApiError, type ErrorApi } from '@/services/pacientes';

/**
 * Contratos del módulo de planes.
 *
 * La API devuelve snapshots de los cuatro nutrimentos principales por item.
 * Si el alimento cambia después, el plan conservado e impreso no cambia.
 */

export type EstadoPlan = 'BORRADOR' | 'ACTIVO' | 'ARCHIVADO';
export type OrigenPlan = 'MANUAL' | 'IA' | 'PLANTILLA';

export type AlimentoResumenPlan = Pick<
  AlimentoFicha,
  'id' | 'nombre' | 'grupo' | 'porcion_descripcion' | 'porcion_gramos' | 'imagen_url'
>;

export type ItemPlanEstructura = {
  id?: string;
  food_id: string | null;
  descripcion_libre: string | null;
  cantidad_porciones: number;
  energia_kcal: number;
  proteina_g: number;
  carbohidratos_g: number;
  lipidos_g: number;
};

export type ItemPlanApi = ItemPlanEstructura & {
  id: string;
  food: AlimentoResumenPlan | null;
};

export type ComidaPlanEstructura = {
  id?: string;
  orden: number;
  nombre: string;
  horario: string | null;
  descripcion: string | null;
  items: ItemPlanEstructura[];
};

export type ComidaPlanApi = Omit<ComidaPlanEstructura, 'items'> & {
  id: string;
  items: ItemPlanApi[];
};

export type PlanApi = {
  id: string;
  patient_id: string;
  estado: EstadoPlan;
  calorias_diarias: number;
  proteina_g: number;
  carbos_g: number;
  grasa_g: number;
  nota: string | null;
  origen: OrigenPlan;
  compartido_at: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
  comidas: ComidaPlanApi[];
};

export type ListaPaginada<T> = {
  data: T[];
  meta: { page: number; per_page: number; total: number };
};

export type GuardarPlanPayload = {
  expected_updated_at?: string;
  estado?: EstadoPlan;
  calorias_diarias?: number;
  proteina_g?: number;
  carbos_g?: number;
  grasa_g?: number;
  nota?: string | null;
  origen?: OrigenPlan;
  plantilla_id?: string;
  comidas?: ComidaPlanEstructura[];
};

export type EstructuraPlantilla = {
  comidas: Array<
    Omit<ComidaPlanEstructura, 'items'> & {
      items: Array<ItemPlanEstructura & { food?: AlimentoResumenPlan | null }>;
    }
  >;
};

export type PlantillaPlanApi = {
  id: string;
  nombre: string;
  objetivo: ObjetivoDb;
  calorias: number;
  descripcion: string | null;
  estructura: EstructuraPlantilla;
  created_at: string;
  updated_at: string;
};

export type GuardarPlantillaPayload = {
  nombre: string;
  objetivo: ObjetivoDb;
  calorias: number;
  descripcion?: string | null;
  estructura: EstructuraPlantilla;
};

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (respuesta.status === 204) return undefined as T;

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { error?: ErrorApi }
    | T
    | null;

  if (!respuesta.ok) {
    const error = (cuerpo as { error?: ErrorApi } | null)?.error;
    throw new ApiError(
      error ?? { code: 'NETWORK_ERROR', message: 'No pudimos contactar al servidor.' },
    );
  }

  return cuerpo as T;
}

export function listarPlanesPaciente(
  pacienteId: string,
  page = 1,
): Promise<ListaPaginada<PlanApi>> {
  return pedir<ListaPaginada<PlanApi>>(
    `/api/v1/patients/${pacienteId}/meal_plans?page=${page}&per_page=100`,
  );
}

export function crearPlan(
  pacienteId: string,
  payload: GuardarPlanPayload,
): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/patients/${pacienteId}/meal_plans`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function obtenerPlan(id: string): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/meal_plans/${id}`);
}

export function actualizarPlan(id: string, payload: GuardarPlanPayload): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/meal_plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function archivarPlan(id: string): Promise<void> {
  return pedir<void>(`/api/v1/meal_plans/${id}`, { method: 'DELETE' });
}

export function compartirPlan(id: string): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/meal_plans/${id}/share`, { method: 'POST' });
}

export function activarPlan(id: string): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/meal_plans/${id}/activate`, { method: 'POST' });
}

export function duplicarPlan(id: string): Promise<PlanApi> {
  return pedir<PlanApi>(`/api/v1/meal_plans/${id}/duplicate`, { method: 'POST' });
}

export function listarPlantillas(page = 1): Promise<ListaPaginada<PlantillaPlanApi>> {
  return pedir<ListaPaginada<PlantillaPlanApi>>(
    `/api/v1/plan_templates?page=${page}&per_page=100`,
  );
}

export function crearPlantilla(payload: GuardarPlantillaPayload): Promise<PlantillaPlanApi> {
  return pedir<PlantillaPlanApi>('/api/v1/plan_templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function actualizarPlantilla(
  id: string,
  payload: Partial<GuardarPlantillaPayload>,
): Promise<PlantillaPlanApi> {
  return pedir<PlantillaPlanApi>(`/api/v1/plan_templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function eliminarPlantilla(id: string): Promise<void> {
  return pedir<void>(`/api/v1/plan_templates/${id}`, { method: 'DELETE' });
}
