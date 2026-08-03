'use client';

import { Loader2, RefreshCw } from 'lucide-react';

import { Btn } from './Btn';

/**
 * Cargando y "no se pudo cargar", en tarjetas del mismo tamaño.
 *
 * Se comparten porque la fase 8 abre cuatro lecturas más (plan, recetas,
 * actividad, detalle de receta) y cada una necesita los dos estados. El aviso de
 * error no dice qué falló técnicamente ni ofrece un cero como dato: en una app
 * de salud, un "0 kcal" por una petición caída se lee como información real.
 */

export function Cargando({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="mx-5 lg:mx-0 flex min-h-48 items-center justify-center rounded-3xl border border-stone-200 bg-white text-emerald-800">
      <Loader2 size={24} className="animate-spin" aria-label={etiqueta} />
    </div>
  );
}

export function ErrorDeCarga({
  titulo,
  onReintentar,
}: {
  titulo: string;
  onReintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-5 lg:mx-0 rounded-3xl border border-red-200 bg-white px-6 py-10 text-center"
    >
      <p className="text-sm font-medium text-emerald-950">{titulo}</p>
      <p className="mt-1 text-xs text-stone-500">
        Revisa tu conexión. Nada de lo que has registrado se perdió.
      </p>
      <Btn onClick={onReintentar} variant="ghost" className="mt-4">
        <RefreshCw size={15} aria-hidden />
        Reintentar
      </Btn>
    </div>
  );
}
