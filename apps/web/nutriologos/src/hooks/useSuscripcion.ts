'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import {
  type SuscripcionApi,
  abrirPortal,
  iniciarCheckout,
  obtenerSuscripcion,
} from '@/services/suscripcion';

/**
 * Estado de la suscripción para la UI: la página `/suscripcion`, el badge del
 * encabezado y el aviso de cupo en pacientes leen todos de esta misma query.
 */

export const CLAVE_SUSCRIPCION = ['suscripcion'] as const;

export function useSuscripcion() {
  return useQuery<SuscripcionApi>({
    queryKey: CLAVE_SUSCRIPCION,
    queryFn: obtenerSuscripcion,
    // El plan cambia por webhook, no por acción del usuario: refrescar cada
    // minuto es suficiente y evita una petición por navegación del panel.
    staleTime: 60_000,
  });
}

/**
 * Checkout y portal devuelven una URL de Stripe y el navegador se va a ella.
 * Se usa `window.location.assign` en vez del router de Next porque el destino
 * es otro dominio.
 */
function irA(url: string): void {
  window.location.assign(url);
}

export function useIniciarCheckout() {
  return useMutation({
    mutationFn: iniciarCheckout,
    onSuccess: ({ url }) => irA(url),
  });
}

export function useAbrirPortal() {
  return useMutation({
    mutationFn: abrirPortal,
    onSuccess: ({ url }) => irA(url),
  });
}
