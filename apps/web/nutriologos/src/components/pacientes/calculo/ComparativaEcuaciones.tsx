'use client';

import { Scale } from 'lucide-react';

import type { ComparativaEcuacion, EcuacionBmr } from '@nutria/shared';

import { SectionCard } from '@/components/ui/SectionCard';

type Props = {
  filas: ComparativaEcuacion[];
  seleccionada: EcuacionBmr;
  onSeleccionar: (ecuacion: EcuacionBmr) => void;
};

/**
 * Selector de ecuación y comparativa en el mismo control: elegir a ciegas entre
 * cuatro nombres no ayuda, ver los cuatro BMR lado a lado sí.
 */
export function ComparativaEcuaciones({ filas, seleccionada, onSeleccionar }: Props) {
  return (
    <SectionCard title="Ecuación de gasto energético" icon={Scale}>
      <fieldset>
        <legend className="sr-only">Ecuación de gasto energético basal</legend>
        <div className="space-y-2">
          {filas.map((fila) => {
            const activa = fila.ecuacion === seleccionada;
            return (
              <label
                key={fila.ecuacion}
                htmlFor={`ecuacion-${fila.ecuacion}`}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  activa
                    ? 'border-emerald-700 bg-emerald-50'
                    : 'border-stone-200 hover:border-stone-300'
                } ${fila.disponible ? '' : 'opacity-60 cursor-not-allowed'}`}
              >
                <input
                  type="radio"
                  id={`ecuacion-${fila.ecuacion}`}
                  name="ecuacion"
                  value={fila.ecuacion}
                  checked={activa}
                  disabled={!fila.disponible}
                  onChange={() => onSeleccionar(fila.ecuacion)}
                  className="mt-1 accent-emerald-800"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-emerald-950 font-medium">{fila.nombre}</div>
                  <div className="text-xs text-stone-500">{fila.descripcion}</div>
                  {!fila.disponible && (
                    <div className="text-xs text-orange-600 mt-1">{fila.motivo}</div>
                  )}
                </div>
                {fila.disponible && (
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm text-emerald-950">{fila.bmr}</div>
                    <div className="text-[11px] text-stone-400">BMR · TDEE {fila.tdee}</div>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
    </SectionCard>
  );
}
