'use client';

import { Ruler } from 'lucide-react';

import type { NivelRiesgo, ResumenAntropometrico } from '@nutria/shared';

import { SectionCard } from '@/components/ui/SectionCard';

const CLASE_RIESGO: Record<NivelRiesgo, string> = {
  bajo: 'text-emerald-700',
  normal: 'text-emerald-700',
  aumentado: 'text-amber-700',
  alto: 'text-orange-700',
  'muy alto': 'text-red-700',
};

function Indicador({
  etiqueta,
  valor,
  nota,
  riesgo,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  riesgo?: NivelRiesgo;
}) {
  return (
    <div className="bg-stone-50 rounded-lg p-3">
      <div className="text-stone-400 text-xs">{etiqueta}</div>
      <div className={`font-medium ${riesgo ? CLASE_RIESGO[riesgo] : 'text-emerald-950'}`}>
        {valor}
      </div>
      {nota && <div className="text-[11px] text-stone-400 mt-0.5">{nota}</div>}
    </div>
  );
}

/** Índices que acompañan al cálculo energético y sustentan la valoración. */
export function PanelAntropometria({ resumen }: { resumen: ResumenAntropometrico }) {
  const { clasificacion, cinturaCadera, cinturaTalla, grasa, pesoIdeal } = resumen;

  return (
    <SectionCard title="Valoración antropométrica" icon={Ruler}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Indicador
          etiqueta="IMC"
          valor={`${resumen.imc}`}
          nota={clasificacion.cortesTallaBaja ? 'Cortes de talla baja (NOM-008)' : undefined}
          riesgo={clasificacion.riesgo}
        />
        <Indicador
          etiqueta="Clasificación"
          valor={clasificacion.categoria}
          riesgo={clasificacion.riesgo}
        />
        <Indicador
          etiqueta="Peso ideal"
          valor={`${pesoIdeal.porImc} kg`}
          nota={`Rango ${pesoIdeal.rangoSaludable.min}–${pesoIdeal.rangoSaludable.max} kg`}
        />
        {cinturaCadera ? (
          <Indicador
            etiqueta="Cintura / cadera"
            valor={cinturaCadera.valor.toFixed(2)}
            nota={`Corte ${cinturaCadera.corte}`}
            riesgo={cinturaCadera.riesgo}
          />
        ) : (
          <Indicador etiqueta="Cintura / cadera" valor="—" nota="Faltan las circunferencias" />
        )}
        {cinturaTalla ? (
          <Indicador
            etiqueta="Cintura / talla"
            valor={cinturaTalla.valor.toFixed(2)}
            nota="Riesgo desde 0.50"
            riesgo={cinturaTalla.riesgo}
          />
        ) : (
          <Indicador etiqueta="Cintura / talla" valor="—" nota="Falta la cintura" />
        )}
        {grasa ? (
          <Indicador
            etiqueta="% de grasa"
            valor={`${grasa.grasaPct}%`}
            nota={
              grasa.origen === 'pliegues'
                ? `Durnin-Womersley · Σ ${grasa.sumaPliegues} mm`
                : 'Capturado en el expediente'
            }
          />
        ) : (
          <Indicador etiqueta="% de grasa" valor="—" nota="Sin pliegues ni medición" />
        )}
      </div>

      {resumen.requierePesoAjustado && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Con IMC {resumen.imc} suele usarse el <strong>peso ajustado</strong> (
          {resumen.pesoAjustado} kg) como insumo del gasto energético. Actívalo abajo si es lo que
          decides para este paciente.
        </div>
      )}
    </SectionCard>
  );
}
