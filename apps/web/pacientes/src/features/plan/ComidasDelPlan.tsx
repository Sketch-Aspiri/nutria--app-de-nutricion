'use client';

import { CalendarDays, Clock, Flame } from 'lucide-react';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { EstadoVacio } from '@/components/ui/Pantalla';

import { descripcionDeItem, totalesDeComida } from './calculos';
import { usePlan } from './usePlan';
import type { ComidaPlan, PlanPaciente } from './types';

/**
 * Comidas del plan vigente, con porciones y kcal.
 *
 * No hay selector de semana. El modelo guarda un plan diario y §12 deja la
 * vista semanal fuera de la V1: el prototipo dibujaba siete días con el martes
 * resaltado, pero ninguno de esos días tenía contenido propio. Mostrar una
 * semana falsa sería peor que no mostrarla.
 */
export function ComidasDelPlan() {
  const plan = usePlan();

  if (plan.isPending) return <Cargando etiqueta="Cargando tu plan" />;
  if (plan.isError) {
    return <ErrorDeCarga titulo="No pudimos cargar tu plan" onReintentar={() => plan.refetch()} />;
  }
  if (!plan.data) {
    return (
      <EstadoVacio
        icono={CalendarDays}
        titulo="Tu nutrióloga aún no comparte tu plan"
        descripcion="En cuanto lo apruebe y te lo envíe, aparecerá aquí con tus comidas, porciones y calorías."
      />
    );
  }

  return (
    <>
      <MetasDelPlan plan={plan.data} />
      {plan.data.nota && (
        <p className="mx-5 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-relaxed text-emerald-900">
          {plan.data.nota}
        </p>
      )}
      <div className="mx-5 mt-3 space-y-2">
        {plan.data.comidas.map((comida) => (
          <TarjetaComida key={comida.id} comida={comida} />
        ))}
      </div>
      {plan.data.comidas.length === 0 && (
        <p className="mx-5 mt-3 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center text-xs text-stone-500">
          Tu plan todavía no tiene comidas capturadas. Pregúntale a tu nutrióloga.
        </p>
      )}
    </>
  );
}

/** Metas diarias del plan: las mismas cifras que el anillo de Hoy compara. */
function MetasDelPlan({ plan }: { plan: PlanPaciente }) {
  const macros = [
    ['Proteína', plan.proteina_g],
    ['Carbos', plan.carbos_g],
    ['Grasa', plan.grasa_g],
  ] as const;

  return (
    <section
      aria-label="Metas diarias de tu plan"
      className="mx-5 rounded-2xl bg-emerald-900 px-4 py-4 text-white"
    >
      <p className="text-[11px] uppercase tracking-wide text-emerald-300">Meta diaria</p>
      <p className="mt-0.5 font-mono text-2xl">
        {Math.round(plan.calorias_diarias)}
        <span className="ml-1 text-sm text-emerald-300">kcal</span>
      </p>
      <dl className="mt-3 flex gap-5">
        {macros.map(([etiqueta, gramos]) => (
          <div key={etiqueta}>
            <dt className="text-[10px] text-emerald-300">{etiqueta}</dt>
            <dd className="font-mono text-sm">{Math.round(gramos)} g</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TarjetaComida({ comida }: { comida: ComidaPlan }) {
  const calorias = Math.round(totalesDeComida(comida).calorias);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-emerald-950">{comida.nombre}</h3>
        {comida.horario && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-stone-400">
            <Clock size={11} aria-hidden />
            {comida.horario}
          </span>
        )}
      </header>

      {comida.descripcion && (
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{comida.descripcion}</p>
      )}

      {comida.items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {comida.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs text-stone-600">
              <span aria-hidden className="mt-1 text-emerald-600">
                •
              </span>
              {descripcionDeItem(item)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 flex items-center gap-1 font-mono text-[11px] text-stone-400">
        <Flame size={11} aria-hidden />
        {calorias} kcal
      </p>
    </article>
  );
}
