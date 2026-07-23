'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Paciente } from '@nutria/shared';

import {
  type CrearPacientePayload,
  type MedicionPayload,
  type OpcionesCalculo,
  type PacienteApi,
  type PacienteResumenApi,
  aPacienteDominio,
  agregarMedicionApi,
  crearPacienteApi,
  guardarCalculoApi,
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
 * puente del cliente (plan, seguimiento, recetas y notas).
 *
 * Devuelve además el cálculo guardado completo: el dominio solo lleva el
 * resultado energético, y `TabCalculo` necesita el snapshot con la comparativa
 * de ecuaciones y los equivalentes.
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
    calculo: (consulta.data as PacienteApi | undefined)?.calculo ?? null,
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

/**
 * Guarda el cálculo del paciente. El servidor recalcula desde el expediente,
 * así que al terminar se refresca el detalle en vez de escribir la respuesta
 * en la caché a mano.
 */
export function useGuardarCalculo(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opciones: OpcionesCalculo) => guardarCalculoApi(pacienteId, opciones),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CLAVE_PACIENTES, pacienteId] });
    },
  });
}

/** Nueva toma de medidas; refresca el expediente para recalcular con ella. */
export function useAgregarMedicion(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicion: MedicionPayload) => agregarMedicionApi(pacienteId, medicion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CLAVE_PACIENTES, pacienteId] });
    },
  });
}
