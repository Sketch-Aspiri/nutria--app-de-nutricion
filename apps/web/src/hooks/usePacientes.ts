'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Paciente } from '@nutria/shared';

import {
  type ActualizarPacientePayload,
  type CrearPacientePayload,
  type ExpedienteMedicoPayload,
  type MedicionPayload,
  type OpcionesCalculo,
  type PacienteApi,
  type PacienteResumenApi,
  type PreferenciasPayload,
  aPacienteDominio,
  actualizarExpedienteMedicoApi,
  actualizarPacienteApi,
  actualizarPreferenciasApi,
  agregarMedicionApi,
  archivarPacienteApi,
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
 * Edición del expediente. Cada bloque vive en su propio recurso REST, así que
 * la pantalla de edición se traduce en varias peticiones.
 *
 * Van en secuencia y no en paralelo para que, si una falla, las siguientes ni
 * se intenten: es preferible un expediente a medio guardar y un error visible
 * que cuatro escrituras compitiendo sin saber cuál quedó.
 */
export type EdicionPaciente = {
  generales: ActualizarPacientePayload;
  expediente: ExpedienteMedicoPayload;
  preferencias: PreferenciasPayload;
  /** Solo cuando cambió alguna medida: una toma nueva se archiva fechada. */
  medicion: MedicionPayload | null;
};

export function useEditarPaciente(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (edicion: EdicionPaciente) => {
      await actualizarPacienteApi(pacienteId, edicion.generales);
      await actualizarExpedienteMedicoApi(pacienteId, edicion.expediente);
      await actualizarPreferenciasApi(pacienteId, edicion.preferencias);
      if (edicion.medicion) await agregarMedicionApi(pacienteId, edicion.medicion);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CLAVE_PACIENTES, pacienteId] });
      void queryClient.invalidateQueries({ queryKey: CLAVE_PACIENTES });
    },
  });
}

/**
 * Da de baja al paciente. El servidor lo archiva en vez de borrarlo, así que
 * basta con invalidar el listado: deja de venir en `/patients` y su detalle
 * en caché queda obsoleto.
 */
export function useArchivarPaciente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archivarPacienteApi(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: [...CLAVE_PACIENTES, id] });
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
