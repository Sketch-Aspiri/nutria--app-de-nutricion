'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

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

const PROGRESO_QUERY_KEY = ['me', 'progress'] as const;

export function useEstimarComida() {
  return useMutation({ mutationFn: estimarComida });
}

export function useRegistrarComida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (estimacion: EstimacionComida) => registrarComida(payloadDeEstimacion(estimacion)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
  });
}

export function useRegistrarFoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ archivo, descripcion }: { archivo: File; descripcion: string }) =>
      registrarFoto(archivo, descripcion),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
  });
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

export function useRegistrarEjercicio() {
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
  });
}

export function usePreguntarCoach() {
  return useMutation({
    mutationFn: ({ mensaje, historial }: { mensaje: string; historial: TurnoCoach[] }) =>
      preguntarCoach(mensaje, historial),
  });
}
