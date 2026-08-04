'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { activarCuentaNutriologa, obtenerNutriologas } from '@/services/superadmin';

const CLAVE_NUTRIOLOGAS = ['superadmin', 'nutriologas'] as const;

export function useNutriologasAdmin(page: number) {
  return useQuery({
    queryKey: [...CLAVE_NUTRIOLOGAS, page],
    queryFn: () => obtenerNutriologas(page),
  });
}

export function useActivarNutriologa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activarCuentaNutriologa,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: CLAVE_NUTRIOLOGAS }),
  });
}
