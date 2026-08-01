'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PROGRESO_QUERY_KEY } from '@/features/progreso/useProgreso';

import {
  estimarComida,
  payloadDeEstimacion,
  preguntarCoach,
  registrarComida,
  registrarEjercicio,
  registrarFoto,
  registrarPeso,
} from './api';
import { HOY_QUERY_KEY } from './useHoy';
import type { EstimacionComida, TurnoCoach } from './types';

export function useEstimarComida() {
  return useMutation({ mutationFn: estimarComida });
}

/**
 * Registrar mueve dos pantallas, no una.
 *
 * Hoy cambia (el anillo, la adherencia) y Progreso también: la racha y la
 * semana completa se calculan desde los mismos registros de comida. Sin
 * invalidar ambas, el paciente registra su cena, entra a Progreso y ve la racha
 * de ayer durante los cinco minutos que dura la caché.
 */
export function useRegistrarComida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (estimacion: EstimacionComida) => registrarComida(payloadDeEstimacion(estimacion)),
    onSuccess: () => invalidarDiaYProgreso(queryClient),
  });
}

export function useRegistrarFoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ archivo, descripcion }: { archivo: File; descripcion: string }) =>
      registrarFoto(archivo, descripcion),
    onSuccess: () => invalidarDiaYProgreso(queryClient),
  });
}

function invalidarDiaYProgreso(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: PROGRESO_QUERY_KEY }),
  ]).then(() => undefined);
}

export function useRegistrarPeso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fecha, pesoKg }: { fecha: string; pesoKg: number }) =>
      registrarPeso(fecha, pesoKg),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROGRESO_QUERY_KEY });
    },
  });
}

/** El ejercicio alimenta el logro "N días activo", así que Progreso se recarga. */
export function useRegistrarEjercicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fecha,
      tipo,
      duracionMin,
    }: {
      fecha: string;
      tipo: string;
      duracionMin: number;
    }) => registrarEjercicio(fecha, tipo, duracionMin),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PROGRESO_QUERY_KEY });
    },
  });
}

export function usePreguntarCoach() {
  return useMutation({
    mutationFn: ({ mensaje, historial }: { mensaje: string; historial: TurnoCoach[] }) =>
      preguntarCoach(mensaje, historial),
  });
}
