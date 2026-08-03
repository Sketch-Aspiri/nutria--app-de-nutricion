'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';

import { descripcionDeComida, totalesDeComida } from './calculos';
import type { ResumenHoy } from './types';
import { useToggleComida } from './useHoy';

export function PlanDelDia({ resumen }: { resumen: ResumenHoy }) {
  const toggle = useToggleComida();
  if (!resumen.plan) {
    return (
      <section className="mx-5 mt-5 rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-7 text-center lg:mx-0">
        <p className="text-sm font-medium text-emerald-950">Aún no tienes un plan compartido</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">
          Tu nutrióloga lo está preparando. Mientras tanto puedes registrar tus comidas.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between px-5">
        <h2 className="font-display text-lg text-emerald-950">Tu plan de hoy</h2>
        <span className="text-[11px] text-stone-400">Toca para marcar</span>
      </div>
      <div className="mx-5 space-y-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {resumen.plan.comidas.map((comida) => {
          const marcada = resumen.comidas_marcadas.includes(comida.id);
          const registroIds = resumen.registros
            .filter((registro) => registro.meal_plan_meal_id === comida.id)
            .map((registro) => registro.id);
          const calorias = Math.round(totalesDeComida(comida).calorias);

          return (
            <button
              key={comida.id}
              type="button"
              aria-pressed={marcada}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ comida, marcada, registroIds })}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-60 ${
                marcada
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-stone-200 bg-white active:border-emerald-300'
              }`}
            >
              {marcada ? (
                <CheckCircle2 size={22} className="shrink-0 text-emerald-700" aria-hidden />
              ) : (
                <Circle size={22} className="shrink-0 text-stone-300" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-emerald-950">{comida.nombre}</span>
                  {comida.horario && (
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                      <Clock size={10} aria-hidden />
                      {comida.horario}
                    </span>
                  )}
                </span>
                <span
                  className={`block truncate text-xs ${
                    marcada ? 'text-stone-400 line-through' : 'text-stone-500'
                  }`}
                >
                  {descripcionDeComida(comida)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-stone-400">{calorias} kcal</span>
            </button>
          );
        })}
      </div>
      {toggle.isError && (
        <p role="alert" className="mx-5 mt-2 text-center text-xs text-red-700 lg:mx-0">
          {toggle.error.message}
        </p>
      )}
    </section>
  );
}
