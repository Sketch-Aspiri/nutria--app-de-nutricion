'use client';

import { useQuery } from '@tanstack/react-query';

import { obtenerProgreso } from './api';

/**
 * Lectura de la pantalla Progreso.
 *
 * La llave la declaraba `features/hoy/useRegistro.ts` cuando registrar el peso
 * era lo único que tocaba este recurso y la pantalla no existía. Ahora vive
 * junto a su consumidor y la hoja de registro la importa: dos constantes con el
 * mismo valor en archivos distintos aguantan hasta que alguien cambia una.
 */
export const PROGRESO_QUERY_KEY = ['me', 'progress'] as const;

/**
 * Un pesaje se registra una vez al día, no cada minuto: se cachea unos minutos
 * en vez de volver a pedirlo en cada montaje. Cuando el paciente registra peso
 * o ejercicio, la mutación invalida esta llave y la gráfica se actualiza sola.
 */
const CINCO_MINUTOS = 5 * 60 * 1000;

export function useProgreso() {
  return useQuery({
    queryKey: PROGRESO_QUERY_KEY,
    queryFn: obtenerProgreso,
    staleTime: CINCO_MINUTOS,
  });
}
