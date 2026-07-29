'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker del cascarón offline.
 *
 * Solo en producción: en desarrollo, un worker activo sirve versiones viejas
 * del cascarón y convierte cada cambio en una sesión de depuración sobre por
 * qué la pantalla no se actualiza.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Falla en silencio a propósito: que el respaldo offline no se instale no
    // le impide al paciente usar la app, y un error en consola no le sirve.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
