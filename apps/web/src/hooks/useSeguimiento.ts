'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  comentarComida,
  compartirPlanActividad,
  guardarPlanActividad,
  listarComidas,
  listarEjercicio,
  listarPesos,
  obtenerAdherencia,
  obtenerPlanActividad,
  registrarPeso,
} from '@/services/seguimiento';

export const CLAVE_SEGUIMIENTO = ['seguimiento'] as const;

function claveDe(pacienteId: string, recurso: string) {
  return [...CLAVE_SEGUIMIENTO, recurso, pacienteId] as const;
}

/**
 * Todo el seguimiento de un paciente en una sola consulta compuesta.
 *
 * Adherencia, comidas, ejercicio y peso se pintan juntos en la misma pestaña;
 * pedirlos por separado dejaría la vista a medio llenar mientras llegan.
 */
export function useSeguimiento(pacienteId: string, dias = 7) {
  const habilitado = Boolean(pacienteId);

  const adherencia = useQuery({
    queryKey: [...claveDe(pacienteId, 'adherencia'), dias],
    queryFn: () => obtenerAdherencia(pacienteId, dias),
    enabled: habilitado,
    retry: false,
  });

  const comidas = useQuery({
    queryKey: claveDe(pacienteId, 'comidas'),
    queryFn: () => listarComidas(pacienteId),
    enabled: habilitado,
    retry: false,
  });

  const ejercicio = useQuery({
    queryKey: claveDe(pacienteId, 'ejercicio'),
    queryFn: () => listarEjercicio(pacienteId),
    enabled: habilitado,
    retry: false,
  });

  const pesos = useQuery({
    queryKey: claveDe(pacienteId, 'pesos'),
    queryFn: () => listarPesos(pacienteId),
    enabled: habilitado,
    retry: false,
  });

  return {
    adherencia: adherencia.data ?? null,
    comidas: comidas.data?.data ?? [],
    ejercicio: ejercicio.data?.data ?? [],
    pesos: pesos.data?.data ?? [],
    cargando:
      adherencia.isPending || comidas.isPending || ejercicio.isPending || pesos.isPending,
    error: adherencia.error ?? comidas.error ?? ejercicio.error ?? pesos.error,
  };
}

export function useComentarComida(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ comidaId, comentario }: { comidaId: string; comentario: string | null }) =>
      comentarComida(comidaId, comentario),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claveDe(pacienteId, 'comidas') });
    },
  });
}

export function useRegistrarPeso(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { fecha: string; peso_kg: number }) =>
      registrarPeso(pacienteId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claveDe(pacienteId, 'pesos') });
      // La tendencia de peso viaja dentro del resumen de adherencia.
      void queryClient.invalidateQueries({ queryKey: claveDe(pacienteId, 'adherencia') });
    },
  });
}

export function usePlanActividad(pacienteId: string) {
  const consulta = useQuery({
    queryKey: claveDe(pacienteId, 'plan-actividad'),
    queryFn: () => obtenerPlanActividad(pacienteId),
    enabled: Boolean(pacienteId),
    retry: false,
  });

  return {
    plan: consulta.data ?? null,
    cargando: consulta.isPending,
  };
}

export function useGuardarPlanActividad(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { texto: string; origen?: 'MANUAL' | 'IA' }) =>
      guardarPlanActividad(pacienteId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claveDe(pacienteId, 'plan-actividad') });
    },
  });
}

export function useCompartirPlanActividad(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => compartirPlanActividad(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: claveDe(pacienteId, 'plan-actividad') });
    },
  });
}
