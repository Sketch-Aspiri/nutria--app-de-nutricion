import { Infinity as InfinityIcon } from 'lucide-react';

import type { LimiteUsoApi } from '@/services/suscripcion';

import { porcentajeUsado } from './formato';

type BarraDeUsoProps = {
  titulo: string;
  uso: LimiteUsoApi;
  sustantivo: string;
};

/**
 * Consumo de un recurso del plan. Cuando el límite es `null` (beta comercial, o
 * un plan sin tope) no hay barra que llenar: mostrar una al 0 % daría a entender
 * que existe un techo.
 */
export function BarraDeUso({ titulo, uso, sustantivo }: BarraDeUsoProps) {
  const ilimitado = uso.limite === null;
  const porcentaje = porcentajeUsado(uso.usados, uso.limite);
  const cerca = !ilimitado && porcentaje >= 80;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-stone-600">{titulo}</span>
        {ilimitado ? (
          <span className="flex items-center gap-1 text-emerald-800 font-medium">
            <InfinityIcon size={14} /> Sin límite
          </span>
        ) : (
          <span className={cerca ? 'text-amber-700 font-medium' : 'text-stone-800 font-medium'}>
            {uso.usados} / {uso.limite}
          </span>
        )}
      </div>
      {ilimitado ? (
        <div className="text-xs text-stone-400 mt-1">
          {uso.usados} {sustantivo} en uso
        </div>
      ) : (
        <>
          <div className="mt-2 h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                uso.alcanzado ? 'bg-red-500' : cerca ? 'bg-amber-500' : 'bg-emerald-700'
              }`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <div className="text-xs text-stone-400 mt-1">
            {uso.alcanzado
              ? `Alcanzaste el tope de ${sustantivo} de tu plan.`
              : `Te quedan ${uso.restantes} ${sustantivo}.`}
          </div>
        </>
      )}
    </div>
  );
}
