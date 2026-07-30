'use client';

import { AlertTriangle, Droplets, Flame } from 'lucide-react';

import type { CalculoNutricional } from '@nutria/shared';
import { NOMBRE_ECUACION } from '@nutria/shared';

import { SectionCard } from '@/components/ui/SectionCard';

function Cifra({ valor, etiqueta, destacada }: { valor: string; etiqueta: string; destacada?: boolean }) {
  return (
    <div>
      <div className={`font-mono ${destacada ? 'text-2xl text-emerald-900' : 'text-xl text-stone-500'}`}>
        {valor}
      </div>
      <div className="text-xs text-stone-400">{etiqueta}</div>
    </div>
  );
}

function Macro({
  gramos,
  etiqueta,
  porcentaje,
  clase,
}: {
  gramos: number;
  etiqueta: string;
  porcentaje: number;
  clase: string;
}) {
  return (
    <div className={`flex-1 border rounded-lg p-3 ${clase}`}>
      <div className="font-mono text-lg">{gramos}g</div>
      <div className="text-xs text-stone-500">
        {etiqueta} · {porcentaje}%
      </div>
    </div>
  );
}

export function PanelResultado({ resultado }: { resultado: CalculoNutricional }) {
  return (
    <SectionCard title="Resultado" icon={Flame}>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Cifra valor={String(resultado.bmr)} etiqueta="BMR (kcal)" />
        <Cifra valor={String(resultado.tdee)} etiqueta="TDEE / mantenimiento" />
        <Cifra valor={String(resultado.objetivoCalorias)} etiqueta="Objetivo diario" destacada />
      </div>

      <div className="text-xs text-stone-500 bg-stone-50 rounded-lg px-3 py-2 mb-4">
        {NOMBRE_ECUACION[resultado.ecuacion]} · peso {resultado.pesoUsado} kg
        {resultado.pesoAjustadoAplicado ? ' (ajustado)' : ''} · factor de actividad{' '}
        {resultado.factorActividad} · ajuste por objetivo{' '}
        {Math.round(resultado.ajusteObjetivo * 100)}%
      </div>

      <div className="text-xs uppercase tracking-wide text-stone-400 mb-2">
        Distribución de macros
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Macro
          gramos={resultado.proteina_g}
          etiqueta="Proteína"
          porcentaje={resultado.pPct}
          clase="bg-lime-50 border-lime-200 text-emerald-900"
        />
        <Macro
          gramos={resultado.carbos_g}
          etiqueta="Carbos"
          porcentaje={resultado.cPct}
          clase="bg-emerald-50 border-emerald-200 text-emerald-900"
        />
        <Macro
          gramos={resultado.grasa_g}
          etiqueta="Grasa"
          porcentaje={resultado.gPct}
          clase="bg-orange-50 border-orange-200 text-orange-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
        <span className="flex items-center gap-2">
          <Droplets size={14} className="text-sky-600" />
          Agua: <span className="font-mono">{(resultado.aguaMl / 1000).toFixed(1)} L/día</span>
        </span>
        {/* El separador solo tiene sentido si ambos datos van en la misma línea. */}
        <span className="hidden text-stone-400 sm:inline">·</span>
        <span>
          Proteína: <span className="font-mono">{resultado.proteinaGPorKg} g/kg</span>
        </span>
      </div>

      {resultado.advertencias.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {resultado.advertencias.map((advertencia) => (
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
