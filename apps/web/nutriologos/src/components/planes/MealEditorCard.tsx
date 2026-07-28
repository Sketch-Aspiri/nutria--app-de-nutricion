'use client';

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import {
  cambiarCantidadItem,
  nuevoItemLibre,
  type ComidaPlanEditable,
  type ItemPlanEditable,
} from '@/components/planes/editor-model';
import { PlanItemRow } from '@/components/planes/PlanItemRow';
import { MAX_ITEMS_POR_COMIDA } from '@/domain/planLimits';

type MealEditorCardProps = {
  comida: ComidaPlanEditable;
  indice: number;
  totalComidas: number;
  conflictoAlergia: boolean;
  onChange: (comida: ComidaPlanEditable) => void;
  onAddFood: () => void;
  onMove: (direccion: -1 | 1) => void;
  onRemove: () => void;
};

const campo =
  'rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-emerald-950 transition-colors hover:border-stone-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100';

export function MealEditorCard({
  comida,
  indice,
  totalComidas,
  conflictoAlergia,
  onChange,
  onAddFood,
  onMove,
  onRemove,
}: MealEditorCardProps) {
  const alcanzoLimite = comida.items.length >= MAX_ITEMS_POR_COMIDA;
  const cambiarItem = (itemIndice: number, siguiente: ItemPlanEditable) => {
    const anterior = comida.items[itemIndice];
    if (!anterior) return;
    const item =
      siguiente.cantidad_porciones !== anterior.cantidad_porciones
        ? cambiarCantidadItem(anterior, siguiente.cantidad_porciones)
        : siguiente;

    onChange({
      ...comida,
      items: comida.items.map((actual, i) => (i === itemIndice ? item : actual)),
    });
  };

  return (
    <article className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_1px_0_rgba(6,78,59,0.03)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-950 font-mono text-xs text-white"
          aria-hidden
        >
          {String(indice + 1).padStart(2, '0')}
        </span>
        <input
          value={comida.nombre}
          onChange={(evento) => onChange({ ...comida, nombre: evento.target.value })}
          aria-label={`Nombre de la comida ${indice + 1}`}
          className={`${campo} min-w-36 flex-1 font-display font-medium`}
        />
        <label className="flex items-center gap-1 text-xs text-stone-400">
          Hora
          <input
            type="time"
            value={comida.horario ?? ''}
            onChange={(evento) => onChange({ ...comida, horario: evento.target.value })}
            aria-label={`Horario de ${comida.nombre}`}
            className={`${campo} w-28 font-mono text-xs`}
          />
        </label>
        {conflictoAlergia && (
          <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700">
            <AlertTriangle size={11} aria-hidden /> Revisar alergia
          </span>
        )}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={indice === 0}
            aria-label={`Subir ${comida.nombre}`}
            className="rounded-md p-1.5 text-stone-400 hover:bg-white hover:text-emerald-800 disabled:opacity-25"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={indice === totalComidas - 1}
            aria-label={`Bajar ${comida.nombre}`}
            className="rounded-md p-1.5 text-stone-400 hover:bg-white hover:text-emerald-800 disabled:opacity-25"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={totalComidas === 1}
            aria-label={`Eliminar ${comida.nombre}`}
            className="rounded-md p-1.5 text-stone-300 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-25"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </header>

      <div className="px-4 py-3">
        <textarea
          value={comida.descripcion ?? ''}
          onChange={(evento) => onChange({ ...comida, descripcion: evento.target.value })}
          placeholder="Indicaciones para esta comida (preparación, sustituciones, contexto)…"
          aria-label={`Indicaciones de ${comida.nombre}`}
          rows={1}
          className="w-full resize-y border-b border-stone-100 bg-transparent pb-2 text-xs leading-5 text-stone-500 focus:border-emerald-400 focus:outline-none"
        />

        {comida.items.length > 0 ? (
          <ul>
            {comida.items.map((item, itemIndice) => (
              <PlanItemRow
                key={item.clave}
                item={item}
                comidaNombre={comida.nombre}
                onChange={(siguiente) => cambiarItem(itemIndice, siguiente)}
                onRemove={() =>
                  onChange({
                    ...comida,
                    items: comida.items.filter((_, i) => i !== itemIndice),
                  })
                }
              />
            ))}
          </ul>
        ) : (
          <div className="py-5 text-center text-xs text-stone-400">
            Aún no hay alimentos en esta comida.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-dashed border-stone-200 pt-3">
          <button
            type="button"
            onClick={onAddFood}
            disabled={alcanzoLimite}
            title={alcanzoLimite ? `Máximo ${MAX_ITEMS_POR_COMIDA} items` : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={13} aria-hidden /> Buscar alimento
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...comida, items: [...comida.items, nuevoItemLibre()] })}
            disabled={alcanzoLimite}
            title={alcanzoLimite ? `Máximo ${MAX_ITEMS_POR_COMIDA} items` : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-stone-500 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} aria-hidden /> Item libre
          </button>
        </div>
      </div>
    </article>
  );
}
