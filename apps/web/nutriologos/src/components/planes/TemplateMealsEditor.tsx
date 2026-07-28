'use client';

import { Plus } from 'lucide-react';

import type { ComidaPlanEditable } from '@/components/planes/editor-model';
import { MealEditorCard } from '@/components/planes/MealEditorCard';
import { MAX_COMIDAS_PLAN } from '@/domain/planLimits';

type TemplateMealsEditorProps = {
  comidas: ComidaPlanEditable[];
  onAddMeal: () => void;
  onChangeMeal: (clave: string, comida: ComidaPlanEditable) => void;
  onAddFood: (clave: string) => void;
  onMoveMeal: (indice: number, direccion: -1 | 1) => void;
  onRemoveMeal: (clave: string) => void;
};

const ADD_MEAL_BUTTON_CLASS = [
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
  'text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed',
  'disabled:opacity-50',
].join(' ');

export function TemplateMealsEditor({
  comidas,
  onAddMeal,
  onChangeMeal,
  onAddFood,
  onMoveMeal,
  onRemoveMeal,
}: TemplateMealsEditorProps) {
  const alcanzoLimite = comidas.length >= MAX_COMIDAS_PLAN;

  return (
    <>
      <div className="my-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display font-medium text-emerald-950">
            Estructura del día
          </h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Los alimentos conservan sus porciones y snapshots.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddMeal}
          disabled={alcanzoLimite}
          title={
            alcanzoLimite ? `Máximo ${MAX_COMIDAS_PLAN} comidas` : undefined
          }
          className={ADD_MEAL_BUTTON_CLASS}
        >
          <Plus size={13} /> Comida
        </button>
      </div>

      <div className="max-h-[48vh] space-y-3 overflow-auto pr-1">
        {comidas.map((comida, indice) => (
          <MealEditorCard
            key={comida.clave}
            comida={comida}
            indice={indice}
            totalComidas={comidas.length}
            conflictoAlergia={false}
            onChange={(siguiente) =>
              onChangeMeal(comida.clave, siguiente)
            }
            onAddFood={() => onAddFood(comida.clave)}
            onMove={(direccion) => onMoveMeal(indice, direccion)}
            onRemove={() => onRemoveMeal(comida.clave)}
          />
        ))}
      </div>
    </>
  );
}
