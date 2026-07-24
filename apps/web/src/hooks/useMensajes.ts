'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  enviarMensaje,
  listarConversaciones,
  listarHilo,
  marcarHiloLeido,
} from '@/services/mensajes';

/**
 * Mensajería por sondeo (sección 8 del plan: tiempo real queda para la V2.1).
 *
 * 30 s en la bandeja y 15 s en el hilo abierto: suficiente para que una
 * conversación no se sienta muerta, y lo bastante espaciado para no convertir
 * el panel abierto todo el día en un goteo constante de consultas.
 */
const MS_SONDEO_BANDEJA = 30_000;
const MS_SONDEO_HILO = 15_000;

export const CLAVE_CONVERSACIONES = ['conversaciones'] as const;
export const CLAVE_HILO = ['hilo-mensajes'] as const;

export function useConversaciones() {
  const consulta = useQuery({
    queryKey: CLAVE_CONVERSACIONES,
    queryFn: listarConversaciones,
    refetchInterval: MS_SONDEO_BANDEJA,
    retry: false,
  });

  return {
    conversaciones: consulta.data?.data ?? [],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useHilo(pacienteId: string) {
  const consulta = useQuery({
    queryKey: [...CLAVE_HILO, pacienteId],
    queryFn: () => listarHilo(pacienteId),
    enabled: Boolean(pacienteId),
    // Solo sondea el hilo que está a la vista.
    refetchInterval: pacienteId ? MS_SONDEO_HILO : false,
    retry: false,
  });

  return {
    mensajes: consulta.data?.data ?? [],
    cargando: consulta.isPending,
    error: consulta.error,
  };
}

export function useEnviarMensaje(pacienteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (texto: string) => enviarMensaje(pacienteId, texto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...CLAVE_HILO, pacienteId] });
      // La bandeja muestra la última línea de cada hilo: también cambió.
      void queryClient.invalidateQueries({ queryKey: CLAVE_CONVERSACIONES });
    },
  });
}

/**
 * Marca leído el hilo abierto.
 *
 * Se dispara al abrir la conversación y cada vez que llegan mensajes nuevos
 * mientras sigue en pantalla: si el nutriólogo está leyendo, el contador de
 * pendientes no debería volver a subir a sus espaldas.
 */
export function useMarcarLeido(pacienteId: string, sinLeer: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pacienteId || sinLeer === 0) return;

    let cancelado = false;
    marcarHiloLeido(pacienteId)
      .then(() => {
        if (cancelado) return;
        void queryClient.invalidateQueries({ queryKey: CLAVE_CONVERSACIONES });
      })
      // Que falle el acuse no debe romper la lectura del hilo: el siguiente
      // sondeo lo reintenta.
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, [pacienteId, sinLeer, queryClient]);
}
