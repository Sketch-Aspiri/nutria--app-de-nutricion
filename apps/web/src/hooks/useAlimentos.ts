'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { AlimentoFicha } from '@nutria/shared';

import {
  actualizarAlimento,
  archivarAlimento,
  crearAlimento,
  listarAlimentos,
  listarGruposAlimento,
  type AlimentoPropioPayload,
  type FiltrosAlimentos,
} from '@/services/alimentos';

export const CLAVE_ALIMENTOS = ['alimentos'] as const;

/** El catálogo no cambia entre teclazos: no vale la pena refrescarlo tan seguido. */
const MINUTOS_FRESCO = 5 * 60 * 1000;

/** Espera antes de consultar mientras el nutriólogo sigue escribiendo. */
const RETARDO_BUSQUEDA_MS = 250;

export function useDebounce<T>(valor: T, retardo = RETARDO_BUSQUEDA_MS): T {
  const [diferido, setDiferido] = useState(valor);

  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(valor), retardo);
    return () => clearTimeout(temporizador);
  }, [valor, retardo]);

  return diferido;
}

/**
 * Búsqueda en la base de alimentos.
 *
 * `keepPreviousData` deja en pantalla el resultado anterior mientras llega el
 * nuevo: sin eso, cada letra vacía la lista y la modal parpadea.
 */
export function useAlimentos(filtros: FiltrosAlimentos) {
  const consulta = useQuery({
    queryKey: [...CLAVE_ALIMENTOS, filtros],
    queryFn: () => listarAlimentos(filtros),
    placeholderData: keepPreviousData,
    staleTime: MINUTOS_FRESCO,
  });

  return {
    alimentos: consulta.data?.data ?? [],
    total: consulta.data?.meta.total ?? 0,
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useGruposAlimento() {
  const consulta = useQuery({
    queryKey: [...CLAVE_ALIMENTOS, 'grupos'],
    queryFn: listarGruposAlimento,
    staleTime: MINUTOS_FRESCO,
  });

  return { grupos: consulta.data?.data ?? [], cargando: consulta.isPending };
}

export function useCrearAlimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AlimentoPropioPayload) => crearAlimento(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_ALIMENTOS });
    },
  });
}

export function useActualizarAlimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<AlimentoPropioPayload> }) =>
      actualizarAlimento(id, cambios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_ALIMENTOS });
    },
  });
}

export function useArchivarAlimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => archivarAlimento(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_ALIMENTOS });
    },
  });
}

export type { AlimentoFicha };
