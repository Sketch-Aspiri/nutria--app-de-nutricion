'use client';

import { Plus } from 'lucide-react';

import { tieneConflictoAlergia, type Paciente } from '@nutria/shared';

import {
  normalizarOrden,
  nuevaComida,
  type PlanEditable,
  type TotalesPlan,
} from '@/components/planes/editor-model';
import { MealEditorCard } from '@/components/planes/MealEditorCard';
import { PlanTotals } from '@/components/planes/PlanTotals';
import { MAX_COMIDAS_PLAN } from '@/domain/planLimits';

type PlanEditorContentProps = {
  plan: PlanEditable;
  totales: TotalesPlan;
  alergias: Paciente['preferencias']['alergias'];
  onChange: (actualizar: (plan: PlanEditable) => PlanEditable) => void;
  onAddFood: (comidaClave: string) => void;
};

const ADD_MEAL_BUTTON_CLASS = [
  'flex w-full items-center justify-center gap-2 rounded-xl border',
  'border-dashed border-stone-300 py-3 text-xs text-stone-500',
  'transition-colors hover:border-emerald-400 hover:bg-emerald-50',
  'hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const PLAN_NOTE_LABEL_CLASS = [
  'block rounded-xl border border-stone-200 bg-white p-4 text-xs',
  'uppercase tracking-wide text-stone-400',
].join(' ');

const PLAN_NOTE_INPUT_CLASS = [
  'mt-2 w-full resize-y bg-transparent text-sm normal-case leading-6',
  'tracking-normal text-stone-600 focus:outline-none',
].join(' ');

export function textoComida(
  comida: PlanEditable['comidas'][number],
): string {
  return [
    comida.nombre,
    comida.descripcion,
    ...comida.items.flatMap((item) => [
      item.food?.nombre,
      item.descripcion_libre,
    ]),
  ]
    .filter(Boolean)
    .join(' ');
}

export function PlanEditorContent({
  plan,
  totales,
  alergias,
  onChange,
  onAddFood,
}: PlanEditorContentProps) {
  const esHistorico = plan.estado !== 'BORRADOR';

  const cambiarComida = (
    clave: string,
    siguiente: PlanEditable['comidas'][number],
  ) =>
    onChange((actual) => ({
      ...actual,
      comidas: actual.comidas.map((comida) =>
        comida.clave === clave ? siguiente : comida,
      ),
    }));

  const moverComida = (indice: number, direccion: -1 | 1) =>
    onChange((actual) => {
      const destino = indice + direccion;
      if (destino < 0 || destino >= actual.comidas.length) return actual;
      const comidas = [...actual.comidas];
      const origen = comidas[indice];
      const receptora = comidas[destino];
      if (!origen || !receptora) return actual;
      comidas[indice] = receptora;
      comidas[destino] = origen;
      return { ...actual, comidas: normalizarOrden(comidas) };
    });

  return (
    <fieldset disabled={esHistorico} className="space-y-4 disabled:opacity-70">
      <legend className="sr-only">Contenido editable del plan</legend>
      <PlanTotals
        plan={plan}
        totales={totales}
        onTargetChange={(campo, valor) =>
          onChange((actual) => ({ ...actual, [campo]: valor }))
        }
      />

      <div className="space-y-3">
        {plan.comidas.map((comida, indice) => (
          <MealEditorCard
            key={comida.clave}
            comida={comida}
            indice={indice}
            totalComidas={plan.comidas.length}
            conflictoAlergia={tieneConflictoAlergia(
              textoComida(comida),
              alergias,
            )}
            onChange={(siguiente) =>
              cambiarComida(comida.clave, siguiente)
            }
            onAddFood={() => onAddFood(comida.clave)}
            onMove={(direccion) => moverComida(indice, direccion)}
            onRemove={() =>
              onChange((actual) => ({
                ...actual,
                comidas: normalizarOrden(
                  actual.comidas.filter(
                    (actualComida) =>
                      actualComida.clave !== comida.clave,
                  ),
                ),
              }))
            }
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          onChange((actual) => ({
            ...actual,
            comidas: [
              ...actual.comidas,
              nuevaComida(actual.comidas.length),
            ],
          }))
        }
        disabled={plan.comidas.length >= MAX_COMIDAS_PLAN}
        title={
          plan.comidas.length >= MAX_COMIDAS_PLAN
            ? `Máximo ${MAX_COMIDAS_PLAN} comidas`
            : undefined
        }
        className={ADD_MEAL_BUTTON_CLASS}
      >
        <Plus size={14} aria-hidden /> Agregar comida
      </button>

      <label className={PLAN_NOTE_LABEL_CLASS}>
        Indicaciones generales para el paciente
        <textarea
          value={plan.nota ?? ''}
          onChange={(evento) =>
            onChange((actual) => ({
              ...actual,
              nota: evento.target.value || null,
            }))
          }
          rows={2}
          placeholder="Hidratación, sustituciones, preparación o notas de seguimiento…"
          className={PLAN_NOTE_INPUT_CLASS}
        />
      </label>
    </fieldset>
  );
}
