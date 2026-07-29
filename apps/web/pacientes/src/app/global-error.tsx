'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Última red de la app. Reporta a Sentry y muestra algo legible: la pantalla
 * blanca de un error no capturado es lo peor que le puede pasar a alguien que
 * abrió la app para registrar su comida.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50 px-8 text-center">
        <h1 className="text-lg font-medium text-emerald-950">Algo salió mal</h1>
        <p className="max-w-xs text-sm text-stone-500">
          No pudimos mostrar esta pantalla. Vuelve a intentarlo en un momento.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-medium text-white"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
