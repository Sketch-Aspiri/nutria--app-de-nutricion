'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <main className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <div className="font-display text-3xl text-emerald-950">nutria</div>
          <h1 className="mt-6 text-lg font-semibold text-stone-900">
            Algo no salió como esperábamos
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            El incidente quedó registrado sin enviar tus datos clínicos.
            Intenta cargar la vista nuevamente.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-emerald-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
