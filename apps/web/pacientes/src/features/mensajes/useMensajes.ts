'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { enviarMensaje, marcarLeidos, obtenerMensajes } from './api';
import { agregarOptimista, mensajeOptimista, sinLeerDe } from './calculos';
import type { RespuestaMensajes } from './types';

/**
 * Mensajería por sondeo, igual que el panel (§12: tiempo real queda fuera de la
 * V1).
 *
 * 15 s con el hilo abierto y 30 s desde la nav inferior, que son los mismos
 * números de `useMensajes.ts` del panel. React Query dedupe por llave: aunque
 * las dos pantallas observen el hilo, hay **una** consulta, no dos.
 *
 * El sondeo se detiene solo cuando la pestaña deja de estar visible
 * —`refetchIntervalInBackground` es `false` por omisión—, así que una PWA
 * abierta en segundo plano no gotea peticiones toda la tarde.
 */
const MS_SONDEO_HILO = 15_000;
const MS_SONDEO_NAV = 30_000;

export const MENSAJES_QUERY_KEY = ['me', 'messages'] as const;

/** El hilo abierto: sondea rápido porque el paciente está esperando respuesta. */
export function useMensajes() {
  return useQuery({
    queryKey: MENSAJES_QUERY_KEY,
    queryFn: obtenerMensajes,
    refetchInterval: MS_SONDEO_HILO,
  });
}

/**
 * Indicador de no leídos para la barra inferior.
 *
 * Comparte llave con `useMensajes`, así que abrir Mensajes no dispara una
 * segunda petición: el sobre ya está en caché y solo cambia cada cuánto se
 * refresca.
 */
export function useSinLeer(): number {
  const consulta = useQuery({
    queryKey: MENSAJES_QUERY_KEY,
    queryFn: obtenerMensajes,
    refetchInterval: MS_SONDEO_NAV,
    // Un fallo de red no debe pintar un globo de "0" ni tumbar la navegación
    // completa: sin dato, no hay indicador.
    retry: false,
  });

  return sinLeerDe(consulta.data);
}

/**
 * Envío con burbuja optimista.
 *
 * El mensaje aparece al instante y se marca como pendiente; si el envío falla,
 * la burbuja desaparece y el redactor recupera el texto. Es la diferencia
 * honesta con el prototipo, que daba por enviado lo que nunca salió del
 * teléfono.
 */
export function useEnviarMensaje() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (texto: string) => enviarMensaje(texto),
    onMutate: async (texto: string) => {
      await queryClient.cancelQueries({ queryKey: MENSAJES_QUERY_KEY });
      const anterior = queryClient.getQueryData<RespuestaMensajes>(MENSAJES_QUERY_KEY);
      if (anterior) {
        queryClient.setQueryData<RespuestaMensajes>(
          MENSAJES_QUERY_KEY,
          agregarOptimista(anterior, mensajeOptimista(texto)),
        );
      }
      return { anterior };
    },
    onError: (_error, _texto, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(MENSAJES_QUERY_KEY, contexto.anterior);
    },
    // Tanto al confirmar como al fallar: el hilo real manda, no la burbuja.
    onSettled: () => queryClient.invalidateQueries({ queryKey: MENSAJES_QUERY_KEY }),
  });
}

/**
 * Acuse de lectura del hilo abierto.
 *
 * Se dispara al entrar y cada vez que el sondeo trae mensajes nuevos mientras
 * el paciente sigue en pantalla: si está leyendo, el indicador no debería
 * volver a encenderse a sus espaldas.
 *
 * Que falle el acuse no rompe la lectura —el hilo ya está en pantalla— y el
 * siguiente sondeo lo reintenta.
 */
export function useMarcarLeidos(sinLeer: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (sinLeer === 0) return;

    let cancelado = false;
    marcarLeidos()
      .then(() => {
        if (cancelado) return;
        void queryClient.invalidateQueries({ queryKey: MENSAJES_QUERY_KEY });
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, [sinLeer, queryClient]);
}
