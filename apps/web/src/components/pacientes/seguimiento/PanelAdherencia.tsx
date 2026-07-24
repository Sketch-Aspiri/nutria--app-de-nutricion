'use client';

import { AlertTriangle, Flame, TrendingDown, TrendingUp } from 'lucide-react';

import { esAdherenciaBaja } from '@nutria/shared';

import { SectionCard } from '@/components/ui/SectionCard';
import type { AdherenciaApi } from '@/services/seguimiento';

const DIA_CORTO = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' });

function etiquetaDia(fecha: string): string {
  return DIA_CORTO.format(new Date(`${fecha}T12:00:00`));
}

export function PanelAdherencia({ datos }: { datos: AdherenciaApi | null }) {
  if (!datos) {
    return (
      <SectionCard title="Adherencia">
        <div className="text-sm text-stone-400">Cargando seguimiento…</div>
      </SectionCard>
    );
  }

  // Sin plan activo no hay contra qué medir: decirlo es más honesto que
  // pintar un 0 %, que se leería como abandono del paciente.
  if (datos.adherencia === null) {
    return (
      <SectionCard title="Adherencia">
        <div className="text-sm text-stone-500">
          Este paciente aún no tiene un plan activo. Activa uno desde la pestaña{' '}
          <strong>Plan</strong> y la adherencia empezará a medirse desde ese día.
        </div>
        {datos.peso && <TendenciaPeso peso={datos.peso} />}
      </SectionCard>
    );
  }

  const baja = esAdherenciaBaja(datos.adherencia);

  return (
    <SectionCard title="Adherencia">
      <div className="flex items-center gap-6">
        <div className="flex-1">
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${baja ? 'bg-orange-400' : 'bg-lime-500'}`}
              style={{ width: `${datos.adherencia}%` }}
            />
          </div>
          <div className="text-xs text-stone-500 mt-1" data-testid="resumen-adherencia">
            <strong>{datos.adherencia}%</strong> — {datos.comidas_registradas} de{' '}
            {datos.comidas_esperadas} comidas registradas en {datos.dias_evaluados}{' '}
            {datos.dias_evaluados === 1 ? 'día' : 'días'}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-emerald-800" data-testid="racha">
          <Flame size={16} /> {datos.racha} {datos.racha === 1 ? 'día' : 'días'} seguidos
        </div>
      </div>

      {datos.desglose.length > 0 && (
        <div className="flex gap-1.5 mt-4">
          {datos.desglose.map((dia) => {
            const proporcion = Math.min(1, dia.registradas / Math.max(1, dia.esperadas));
            return (
              <div key={dia.fecha} className="flex-1 text-center">
                <div
                  className="h-10 bg-stone-100 rounded flex items-end overflow-hidden"
                  title={`${dia.fecha}: ${dia.registradas} de ${dia.esperadas}`}
                >
                  <div
                    className={`w-full ${proporcion >= 1 ? 'bg-lime-500' : 'bg-lime-300'}`}
                    style={{ height: `${proporcion * 100}%` }}
                  />
                </div>
                <div className="text-[10px] text-stone-400 mt-1">{etiquetaDia(dia.fecha)}</div>
              </div>
            );
          })}
        </div>
      )}

      {baja && (
        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-3">
          <AlertTriangle size={13} /> Adherencia baja — considera contactar al paciente o
          simplificar el plan.
        </div>
      )}

      {datos.peso && <TendenciaPeso peso={datos.peso} />}
    </SectionCard>
  );
}

function TendenciaPeso({ peso }: { peso: NonNullable<AdherenciaApi['peso']> }) {
  const bajo = peso.cambio_kg < 0;
  const sinCambio = peso.cambio_kg === 0;

  return (
    <div className="flex items-center gap-2 text-xs text-stone-500 mt-3 border-t border-stone-100 pt-3">
      {!sinCambio &&
        (bajo ? (
          <TrendingDown size={14} className="text-lime-600" />
        ) : (
          <TrendingUp size={14} className="text-orange-500" />
        ))}
      <span>
        Peso: {peso.inicial_kg} kg → <strong>{peso.actual_kg} kg</strong>
        {!sinCambio && ` (${peso.cambio_kg > 0 ? '+' : ''}${peso.cambio_kg} kg)`}
      </span>
    </div>
  );
}
