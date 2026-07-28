'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import {
  type EventoIA,
  type PeticionIA,
  type SalidaIA,
  generarIA,
  generarIAConStream,
  obtenerCuotaIA,
} from '@/services/ia';

/**
 * Acceso a la IA desde la UI. Cada generación consume cuota, así que al terminar
 * se invalida `cuotaIA` para que el contador que ve el nutriólogo no mienta.
 */

const CLAVE_CUOTA = ['cuotaIA'] as const;

/** Cuota mensual de generaciones del plan vigente. */
export function useCuotaIA() {
  return useQuery({
    queryKey: CLAVE_CUOTA,
    queryFn: obtenerCuotaIA,
    staleTime: 60_000,
  });
}

/** Generación sin streaming, para las respuestas cortas. */
export function useGenerarIA<T = unknown>() {
  const queryClient = useQueryClient();
  return useMutation<SalidaIA<T>, Error, PeticionIA>({
    mutationFn: (peticion) => generarIA<T>(peticion),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUOTA }),
  });
}

export type EstadoStreamIA = {
  /** Texto acumulado; solo se llena en las generaciones de salida libre. */
  parcial: string;
  /** Caracteres recibidos de una salida estructurada, para el indicador. */
  avance: number;
  /** Motivos por los que se está reintentando la generación. */
  reintento: string[] | null;
};

const ESTADO_INICIAL: EstadoStreamIA = { parcial: '', avance: 0, reintento: null };

/**
 * Generación con streaming, para plan y recetas: el nutriólogo ve avance en vez
 * de un spinner de treinta segundos.
 */
export function useGenerarIAConStream<T = unknown>() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoStreamIA>(ESTADO_INICIAL);
  const abortRef = useRef<AbortController | null>(null);

  const alEvento = useCallback((evento: EventoIA) => {
    setEstado((previo) => {
      switch (evento.tipo) {
        case 'delta':
          return { ...previo, parcial: previo.parcial + evento.texto };
        case 'progreso':
          return { ...previo, avance: evento.caracteres };
        case 'reintento':
          // Un reintento descarta lo acumulado: la salida anterior se rechazó.
          return { parcial: '', avance: 0, reintento: evento.motivos };
      }
    });
  }, []);

  const mutacion = useMutation<SalidaIA<T>, Error, PeticionIA>({
    mutationFn: (peticion) => {
      setEstado(ESTADO_INICIAL);
      abortRef.current?.abort();
      const controlador = new AbortController();
      abortRef.current = controlador;
      return generarIAConStream<T>(peticion, alEvento, controlador.signal);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLAVE_CUOTA }),
  });

  const cancelar = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { ...mutacion, estado, cancelar };
}
