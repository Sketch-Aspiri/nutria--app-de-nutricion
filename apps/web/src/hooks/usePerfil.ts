'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ActualizarPerfilPayload,
  actualizarPerfil,
  obtenerPerfil,
} from '@/services/perfil';

export const CLAVE_PERFIL = ['perfil'] as const;

export function usePerfil() {
  return useQuery({
    queryKey: CLAVE_PERFIL,
    queryFn: obtenerPerfil,
  });
}

export function useActualizarPerfil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ActualizarPerfilPayload) => actualizarPerfil(payload),
    onSuccess: (perfil) => {
      queryClient.setQueryData(CLAVE_PERFIL, perfil);
    },
  });
}
