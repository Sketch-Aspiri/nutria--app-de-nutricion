'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type ActualizarCitaPayload,
  actualizarCita,
  cancelarCita,
  type CitaApi,
  completarCita,
  crearCita,
  type CrearCitaPayload,
  eliminarCita,
  type FiltroCitas,
  listarCitas,
  marcarInasistencia,
} from '@/services/agenda';

export const CLAVE_CITAS = ['citas'] as const;

export function useCitas(filtros: FiltroCitas = {}) {
  const consulta = useQuery({
    queryKey: [...CLAVE_CITAS, filtros],
    queryFn: () => listarCitas(filtros),
    retry: false,
  });

  return {
    citas: consulta.data?.data ?? [],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

/**
 * Toda mutación de la agenda invalida el listado completo.
 *
 * Actualizar la fila en caché sería más fino, pero cancelar o reprogramar
 * cambia el orden y puede sacar la cita del rango consultado; releer es lo
 * único que deja la vista consistente sin duplicar aquí las reglas del
 * servidor.
 */
function useMutacionDeCita<TVariables>(
  mutationFn: (variables: TVariables) => Promise<CitaApi | void>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_CITAS });
    },
  });
}

export function useCrearCita() {
  return useMutacionDeCita((payload: CrearCitaPayload) => crearCita(payload));
}

export function useActualizarCita() {
  return useMutacionDeCita(({ id, ...payload }: ActualizarCitaPayload & { id: string }) =>
    actualizarCita(id, payload),
  );
}

export function useCancelarCita() {
  return useMutacionDeCita((id: string) => cancelarCita(id));
}

export function useCompletarCita() {
  return useMutacionDeCita((id: string) => completarCita(id));
}

export function useMarcarInasistencia() {
  return useMutacionDeCita((id: string) => marcarInasistencia(id));
}

export function useEliminarCita() {
  return useMutacionDeCita((id: string) => eliminarCita(id));
}
