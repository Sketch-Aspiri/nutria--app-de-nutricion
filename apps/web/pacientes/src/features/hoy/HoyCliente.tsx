'use client';

import { Flame, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { AvatarPerfil } from '@/components/ui/Avatar';
import { Btn } from '@/components/ui/Btn';
import { Pantalla } from '@/components/ui/Pantalla';

import { calcularTotalesHoy } from './calculos';
import { CoachSheet } from './CoachSheet';
import { PlanDelDia } from './PlanDelDia';
import { RegistrosDia } from './RegistrosDia';
import { ResumenNutricional } from './ResumenNutricional';
import { TarjetasDia } from './TarjetasDia';
import { useHoy } from './useHoy';

export function HoyCliente({ nombre }: { nombre: string }) {
  const hoy = useHoy();
  const [coachAbierto, setCoachAbierto] = useState(false);
  const primerNombre = nombre.split(' ')[0] || 'Hola';

  if (hoy.isLoading) {
    return (
      <Pantalla
        titulo={primerNombre}
        subtitulo="Buen día"
        accion={<AvatarPerfil nombre={nombre} />}
      >
        <div className="mx-5 flex min-h-64 items-center justify-center rounded-3xl border border-stone-200 bg-white text-emerald-800">
          <Loader2 size={24} className="animate-spin" aria-label="Cargando tu día" />
        </div>
      </Pantalla>
    );
  }

  if (hoy.isError || !hoy.data) {
    return (
      <Pantalla
        titulo={primerNombre}
        subtitulo="Buen día"
        accion={<AvatarPerfil nombre={nombre} />}
      >
        <div className="mx-5 rounded-3xl border border-red-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-emerald-950">No pudimos cargar tu día</p>
          <p className="mt-1 text-xs text-stone-500">
            Revisa tu conexión. Tus registros guardados siguen seguros.
          </p>
          <Btn onClick={() => hoy.refetch()} variant="ghost" className="mt-4">
            <RefreshCw size={15} aria-hidden />
            Reintentar
          </Btn>
        </div>
      </Pantalla>
    );
  }

  const resumen = hoy.data;
  const totales = calcularTotalesHoy(resumen);

  return (
    <Pantalla
      titulo={primerNombre}
      subtitulo="Buen día"
      accion={
        <div className="flex items-center gap-2">
          {resumen.adherencia && (
            <span
              aria-label={`Racha de ${resumen.adherencia.racha} días`}
              className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1.5 font-mono text-xs text-amber-700"
            >
              <Flame size={14} aria-hidden />
              {resumen.adherencia.racha}
            </span>
          )}
          <AvatarPerfil nombre={nombre} />
        </div>
      }
    >
      <ResumenNutricional plan={resumen.plan} totales={totales} />
      <TarjetasDia resumen={resumen} />
      <PlanDelDia resumen={resumen} />
      <RegistrosDia registros={resumen.registros} />

      <button
        type="button"
        onClick={() => setCoachAbierto(true)}
        className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl bg-emerald-900 p-4 text-left text-white transition-transform active:scale-[0.99]"
      >
        <span className="rounded-full bg-emerald-800 p-2.5">
          <Sparkles size={18} aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">Pregúntale a tu coach</span>
          <span className="block text-xs text-emerald-300">Dudas sobre tu plan, al instante</span>
        </span>
      </button>

      {coachAbierto && <CoachSheet onClose={() => setCoachAbierto(false)} />}
    </Pantalla>
  );
}
