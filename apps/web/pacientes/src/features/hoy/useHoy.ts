'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  borrarRegistroComida,
  guardarAgua,
  obtenerHoy,
  registrarComida,
  type RegistrarComidaPayload,
} from './api';
import { nutrientesParaRegistroPlan } from './calculos';
import { cambiarAguaOptimista, desmarcarComidaOptimista, marcarComidaOptimista } from './optimismo';
import type { ComidaPlanHoy, ResumenHoy } from './types';

export const HOY_QUERY_KEY = ['me', 'today'] as const;

export function useHoy(enabled = true, staleTime?: number) {
  return useQuery({
    queryKey: HOY_QUERY_KEY,
    queryFn: obtenerHoy,
    enabled,
    staleTime,
  });
}

type ToggleComida = {
  comida: ComidaPlanHoy;
  marcada: boolean;
  registroIds: string[];
};

export function useToggleComida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comida, marcada, registroIds }: ToggleComida) => {
      if (marcada) {
        if (registroIds.length === 0) {
          throw new Error('No se encontró el registro que se quiere desmarcar.');
        }
        await Promise.all(registroIds.map(borrarRegistroComida));
        return;
      }

      const nutrientes = nutrientesParaRegistroPlan(comida);
      const payload: RegistrarComidaPayload = {
        meal_plan_meal_id: comida.id,
        nombre: comida.nombre,
        calorias: nutrientes.calorias,
        proteina_g: nutrientes.proteina,
        carbos_g: nutrientes.carbos,
        grasa_g: nutrientes.grasa,
        origen: 'MANUAL',
      };
      await registrarComida(payload);
    },
    onMutate: async ({ comida, marcada, registroIds }) => {
      await queryClient.cancelQueries({ queryKey: HOY_QUERY_KEY });
      const anterior = queryClient.getQueryData<ResumenHoy>(HOY_QUERY_KEY);
      if (anterior) {
        queryClient.setQueryData<ResumenHoy>(
          HOY_QUERY_KEY,
          marcada && registroIds.length > 0
            ? desmarcarComidaOptimista(anterior, comida.id, registroIds)
            : marcarComidaOptimista(anterior, comida),
        );
      }
      return { anterior };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(HOY_QUERY_KEY, contexto.anterior);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
  });
}

export function useGuardarAgua() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fecha, vasos }: { fecha: string; vasos: number }) => guardarAgua(fecha, vasos),
    onMutate: async ({ vasos }) => {
      await queryClient.cancelQueries({ queryKey: HOY_QUERY_KEY });
      const anterior = queryClient.getQueryData<ResumenHoy>(HOY_QUERY_KEY);
      if (anterior) {
        queryClient.setQueryData(HOY_QUERY_KEY, cambiarAguaOptimista(anterior, vasos));
      }
      return { anterior };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(HOY_QUERY_KEY, contexto.anterior);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
  });
}

export function useBorrarRegistro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: borrarRegistroComida,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOY_QUERY_KEY }),
  });
}
