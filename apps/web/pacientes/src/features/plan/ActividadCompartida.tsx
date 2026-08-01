'use client';

import { Activity } from 'lucide-react';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { EstadoVacio } from '@/components/ui/Pantalla';

import { usePlanActividad } from './usePlan';

/**
 * Plan de actividad, si la nutrióloga compartió uno.
 *
 * Es un texto libre que ella escribe, no una rutina estructurada: se respeta su
 * formato —los saltos de línea son suyos— y no se reinterpreta como lista de
 * ejercicios con series y repeticiones que nadie capturó.
 */
export function ActividadCompartida() {
  const actividad = usePlanActividad();

  if (actividad.isPending) return <Cargando etiqueta="Cargando tu plan de actividad" />;
  if (actividad.isError) {
    return (
      <ErrorDeCarga
        titulo="No pudimos cargar tu plan de actividad"
        onReintentar={() => actividad.refetch()}
      />
    );
  }
  if (!actividad.data) {
    return (
      <EstadoVacio
        icono={Activity}
        titulo="No tienes un plan de actividad"
        descripcion="Si tu nutrióloga te comparte uno, lo encontrarás aquí. Mientras tanto puedes registrar tu ejercicio desde el botón +."
      />
    );
  }

  return (
    <section className="mx-5 rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-950">
        <Activity size={16} className="text-emerald-800" aria-hidden />
        Tu actividad
      </h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">
        {actividad.data.texto}
      </p>
    </section>
  );
}
