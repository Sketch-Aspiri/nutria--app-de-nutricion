'use client';

import { Link2, Trash2 } from 'lucide-react';

import type { ItemPlanEditable } from '@/components/planes/editor-model';

type PlanItemRowProps = {
  item: ItemPlanEditable;
  comidaNombre: string;
  onChange: (item: ItemPlanEditable) => void;
  onRemove: () => void;
};

const inputNumero =
  'w-16 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-right font-mono text-xs text-emerald-950 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export function PlanItemRow({
  item,
  comidaNombre,
  onChange,
  onRemove,
}: PlanItemRowProps) {
  const nombre = item.food?.nombre ?? item.descripcion_libre ?? 'Alimento';

  return (
    <li className="grid gap-3 border-t border-stone-100 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {item.food_id && <Link2 size={12} className="shrink-0 text-emerald-600" aria-hidden />}
          {item.food_id ? (
            <span className="truncate text-sm font-medium text-emerald-950">{nombre}</span>
          ) : (
            <input
              value={item.descripcion_libre ?? ''}
              onChange={(evento) =>
                onChange({ ...item, descripcion_libre: evento.target.value })
              }
              aria-label={`Descripción del alimento libre en ${comidaNombre}`}
              placeholder="Describe el alimento o preparación"
              className="min-w-0 flex-1 border-b border-stone-200 bg-transparent text-sm text-emerald-950 focus:border-emerald-500 focus:outline-none"
            />
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${nombre} de ${comidaNombre}`}
            className="ml-auto rounded-md p-1 text-stone-300 transition-colors hover:bg-orange-50 hover:text-orange-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          {item.food
            ? `${item.food.porcion_descripcion} · ${item.food.porcion_gramos} g por porción`
            : 'Item libre · captura sus aportes para conservar el snapshot'}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 sm:justify-end">
        <label className="text-[10px] uppercase tracking-wide text-stone-400">
          Porciones
          <input
            type="number"
            min={0.05}
            step={0.25}
            value={item.cantidad_porciones}
            onChange={(evento) =>
              onChange({
                ...item,
                cantidad_porciones: Number(evento.target.value),
              })
            }
            className={`${inputNumero} mt-1 block`}
          />
        </label>
        {(
          [
            ['energia_kcal', 'kcal'],
            ['proteina_g', 'prot.'],
            ['carbohidratos_g', 'carb.'],
            ['lipidos_g', 'grasa'],
          ] as const
        ).map(([campo, etiqueta]) => (
          <label key={campo} className="text-[10px] uppercase tracking-wide text-stone-400">
            {etiqueta}
            <input
              type="number"
              min={0}
              step={0.1}
              value={item[campo]}
              readOnly={Boolean(item.food_id)}
              onChange={(evento) =>
                onChange({ ...item, [campo]: Number(evento.target.value) })
              }
              className={`${inputNumero} mt-1 block ${
                item.food_id ? 'cursor-default bg-stone-50 text-stone-500' : ''
              }`}
              aria-label={`${etiqueta} de ${nombre}`}
            />
          </label>
        ))}
      </div>
    </li>
  );
}
