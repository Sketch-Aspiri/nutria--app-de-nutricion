'use client';

import { AlertTriangle, Apple } from 'lucide-react';

import type { DistribucionEquivalentes } from '@nutria/shared';

import { SectionCard } from '@/components/ui/SectionCard';

/**
 * Reparto en equivalentes SMAE: es el formato en que el nutriólogo mexicano
 * entrega el plan, más útil que los gramos de macro en la consulta.
 */
export function PanelEquivalentes({ distribucion }: { distribucion: DistribucionEquivalentes }) {
  const { renglones, totales, desviacion, advertencias } = distribucion;

  return (
    <SectionCard title="Equivalentes SMAE por grupo" icon={Apple}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Equivalentes por grupo de alimentos</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-stone-400 text-left">
              <th scope="col" className="font-normal pb-2">
                Grupo
              </th>
              <th scope="col" className="font-normal pb-2 text-right">
                Equiv.
              </th>
              <th scope="col" className="font-normal pb-2 text-right">
                kcal
              </th>
              <th scope="col" className="font-normal pb-2 text-right">
                Prot.
              </th>
              <th scope="col" className="font-normal pb-2 text-right">
                HC
              </th>
              <th scope="col" className="font-normal pb-2 text-right">
                Lip.
              </th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((fila) => (
              <tr key={fila.grupo} className="border-t border-stone-100">
                <th scope="row" className="py-1.5 font-normal text-emerald-950 text-left">
                  {fila.nombre}
                </th>
                <td className="py-1.5 text-right font-mono text-emerald-900">
                  {fila.equivalentes}
                </td>
                <td className="py-1.5 text-right font-mono text-stone-500">{fila.kcal}</td>
                <td className="py-1.5 text-right font-mono text-stone-500">{fila.proteina_g}</td>
                <td className="py-1.5 text-right font-mono text-stone-500">{fila.carbos_g}</td>
                <td className="py-1.5 text-right font-mono text-stone-500">{fila.grasa_g}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-300 text-emerald-950">
              <th scope="row" className="py-2 text-left font-medium">
                Total
              </th>
              <td />
              <td className="py-2 text-right font-mono">{totales.kcal}</td>
              <td className="py-2 text-right font-mono">{totales.proteina_g}</td>
              <td className="py-2 text-right font-mono">{totales.carbos_g}</td>
              <td className="py-2 text-right font-mono">{totales.grasa_g}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-xs text-stone-500 mt-3">
        Diferencia con la meta: {desviacion.kcal > 0 ? '+' : ''}
        {desviacion.kcal} kcal ({desviacion.kcalPct > 0 ? '+' : ''}
        {desviacion.kcalPct}%).
      </div>

      {advertencias.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {advertencias.map((advertencia) => (
            <li key={advertencia} className="flex gap-2 text-xs text-orange-700">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {advertencia}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
