'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Paciente } from '@nutria/shared';

import {
  type CrearPacientePayload,
  type PacienteApi,
  type PacienteResumenApi,
  aPacienteDominio,
  crearPacienteApi,
  listarPacientes,
  obtenerPaciente,
} from '@/services/pacientes';
import { useExtrasPaciente } from '@/store/app-state';

export const CLAVE_PACIENTES = ['pacientes'] as const;

export function usePacientes() {
  const consulta = useQuery({
    queryKey: CLAVE_PACIENTES,
    queryFn: listarPacientes,
  });

  return {
    pacientes: (consulta.data?.data ?? []) as PacienteResumenApi[],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

/**
 * Compone el paciente de la base con los campos que aún viven en el almacén
 * puente del cliente (cálculo, plan, seguimiento, recetas y notas).
 */
export function usePaciente(id: string) {
  const consulta = useQuery({
    queryKey: [...CLAVE_PACIENTES, id],
    queryFn: () => obtenerPaciente(id),
    enabled: Boolean(id),
    retry: false,
  });

  const extras = useExtrasPaciente(id);

  const paciente = useMemo<Paciente | null>(
    () => (consulta.data ? aPacienteDominio(consulta.data as PacienteApi, extras) : null),
    [consulta.data, extras],
  );

  return {
    paciente,
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useCrearPaciente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CrearPacientePayload) => crearPacienteApi(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_PACIENTES });
    },
  });
}
