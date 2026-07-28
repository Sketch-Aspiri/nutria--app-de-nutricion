'use client';

import { Sigma } from 'lucide-react';

import type { PlanEditable, TotalesPlan } from '@/components/planes/editor-model';

type CampoMeta = 'calorias_diarias' | 'proteina_g' | 'carbos_g' | 'grasa_g';

type PlanTotalsProps = {
  plan: PlanEditable;
  totales: TotalesPlan;
  onTargetChange: (campo: CampoMeta, valor: number) => void;
};

type Metrica = {
  campo: CampoMeta;
  etiqueta: string;
  unidad: string;
  actual: number;
};

function tono(actual: number, meta: number): string {
  if (meta <= 0) return 'bg-stone-300';
  const diferencia = Math.abs(actual - meta) / meta;
  if (diferencia <= 0.05) return 'bg-emerald-600';
  return actual > meta ? 'bg-orange-400' : 'bg-lime-500';
}

export function PlanTotals({ plan, totales, onTargetChange }: PlanTotalsProps) {
  const metricas: Metrica[] = [
    {
      campo: 'calorias_diarias',
      etiqueta: 'Energía',
      unidad: 'kcal',
      actual: totales.energia_kcal,
    },
    {
      campo: 'proteina_g',
      etiqueta: 'Proteína',
      unidad: 'g',
      actual: totales.proteina_g,
    },
    {
      campo: 'carbos_g',
      etiqueta: 'Carbohidratos',
      unidad: 'g',
      actual: totales.carbohidratos_g,
    },
    {
      campo: 'grasa_g',
      etiqueta: 'Grasas',
      unidad: 'g',
      actual: totales.lipidos_g,
    },
  ];

  return (
    <section
      aria-labelledby="totales-plan"
      className="rounded-xl border border-emerald-900/10 bg-emerald-950 px-4 py-4 text-white"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="totales-plan" className="flex items-center gap-2 text-sm font-medium">
            <Sigma size={14} aria-hidden /> Balance del día
          </h3>
          <p className="mt-1 text-[11px] text-emerald-100/60">
            Total de los alimentos frente a la meta clínica.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-emerald-100/70">
          Snapshot nutrimental
        </span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-4">
        {metricas.map((metrica) => {
          const meta = plan[metrica.campo];
          const progreso =
            meta > 0 ? Math.min(Math.max((metrica.actual / meta) * 100, 0), 100) : 0;

          return (
            <div key={metrica.campo} className="bg-emerald-950 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-100/50">
                {metrica.etiqueta}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-lg">
                  {Math.round(metrica.actual * 10) / 10}
                </span>
                <span className="text-[10px] text-emerald-100/50">{metrica.unidad}</span>
              </div>
              <div className="my-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] ${tono(
                    metrica.actual,
                    meta,
                  )}`}
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <label className="flex items-center gap-1 text-[10px] text-emerald-100/50">
                meta
                <input
                  type="number"
                  min={0}
                  value={meta}
                  onChange={(evento) =>
                    onTargetChange(metrica.campo, Number(evento.target.value))
                  }
                  aria-label={`Meta de ${metrica.etiqueta}`}
                  className="w-16 border-b border-white/20 bg-transparent px-1 text-right font-mono text-xs text-white focus:border-lime-300 focus:outline-none"
                />
                {metrica.unidad}
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );
}
