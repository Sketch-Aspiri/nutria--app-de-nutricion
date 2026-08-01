import { json, pedir, pedirLista } from '@/lib/apiCliente';

import type { PlanActividad, PlanPaciente, Receta, RespuestaSustitucion } from './types';

/**
 * Lecturas de la pantalla Plan.
 *
 * Ninguna acepta `patient_id`: el servidor lo resuelve desde la sesión con
 * `requierePaciente`. Y ninguna pide "todas las recetas" — el endpoint solo
 * expone las enviadas, así que la app no tiene forma de ver un borrador.
 */

export function obtenerPlan(): Promise<PlanPaciente | null> {
  return pedir<PlanPaciente | null>('/api/v1/me/meal_plan');
}

export function obtenerRecetas(): Promise<Receta[]> {
  return pedirLista<Receta>('/api/v1/me/recipes');
}

export function obtenerPlanActividad(): Promise<PlanActividad | null> {
  return pedir<PlanActividad | null>('/api/v1/me/activity_plan');
}

export type SustitucionPayload = {
  ingrediente: string;
  receta_id?: string;
};

export function sustituirIngrediente(payload: SustitucionPayload): Promise<RespuestaSustitucion> {
  return json<RespuestaSustitucion>('/api/v1/me/ai/substitution', 'POST', payload);
}
