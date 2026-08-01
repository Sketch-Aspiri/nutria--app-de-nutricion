'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import {
  obtenerPlan,
  obtenerPlanActividad,
  obtenerRecetas,
  sustituirIngrediente,
  type SustitucionPayload,
} from './api';

/**
 * Lecturas de la pantalla Plan.
 *
 * Un plan cambia cuando la nutrióloga lo comparte, no cada minuto, así que se
 * cachea unos minutos en vez de pedirlo en cada montaje: la pestaña Plan se
 * visita muchas veces al día y volver a ella no debería parpadear.
 */
const CINCO_MINUTOS = 5 * 60 * 1000;

export const PLAN_QUERY_KEY = ['me', 'meal_plan'] as const;
export const RECETAS_QUERY_KEY = ['me', 'recipes'] as const;
export const ACTIVIDAD_QUERY_KEY = ['me', 'activity_plan'] as const;

export function usePlan() {
  return useQuery({
    queryKey: PLAN_QUERY_KEY,
    queryFn: obtenerPlan,
    staleTime: CINCO_MINUTOS,
  });
}

export function useRecetas() {
  return useQuery({
    queryKey: RECETAS_QUERY_KEY,
    queryFn: obtenerRecetas,
    staleTime: CINCO_MINUTOS,
  });
}

export function usePlanActividad() {
  return useQuery({
    queryKey: ACTIVIDAD_QUERY_KEY,
    queryFn: obtenerPlanActividad,
    staleTime: CINCO_MINUTOS,
  });
}

/**
 * Sustitución de un ingrediente con IA.
 *
 * No invalida nada ni escribe en caché: la sugerencia es una propuesta que el
 * paciente lee, no un cambio a su receta. Guardarla sería editar contenido que
 * su nutrióloga aprobó, y eso lo prohíbe `ai-guidelines.md`.
 */
export function useSustituirIngrediente() {
  return useMutation({
    mutationFn: (payload: SustitucionPayload) => sustituirIngrediente(payload),
  });
}
