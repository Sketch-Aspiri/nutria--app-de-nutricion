import type { PlanHoy, TotalesNutricionales } from './types';

export function ResumenNutricional({
  plan,
  totales,
}: {
  plan: PlanHoy | null;
  totales: TotalesNutricionales;
}) {
  if (!plan) {
    return (
      <section className="mx-5 overflow-hidden rounded-3xl bg-emerald-950 px-5 py-5 text-white">
        <p className="text-xs text-emerald-300">Registrado hoy</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="font-mono text-3xl">{totales.calorias}</p>
          <p className="pb-1 text-xs text-emerald-300">kcal · sin meta activa</p>
        </div>
        <p className="mt-3 border-t border-emerald-800 pt-3 text-xs leading-relaxed text-emerald-200">
          Cuando tu nutrióloga comparta un plan, aquí verás cuánto te falta y tus metas de macros.
        </p>
      </section>
    );
  }

  const restantes = Math.max(plan.calorias_diarias - totales.calorias, 0);

  return (
    <section className="mx-5 rounded-3xl border border-stone-200 bg-white p-5">
      <div className="flex justify-center">
        <Anillo valor={totales.calorias} meta={plan.calorias_diarias}>
          <span className="font-mono text-3xl text-emerald-950">{restantes}</span>
          <span className="-mt-1 text-[11px] text-stone-400">kcal restantes</span>
          <span className="mt-1 text-[10px] text-stone-400">
            {totales.calorias} de {plan.calorias_diarias}
          </span>
        </Anillo>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <MacroBar
          etiqueta="Proteína"
          valor={totales.proteina}
          meta={plan.proteina_g}
          color="bg-teal-600"
        />
        <MacroBar
          etiqueta="Carbos"
          valor={totales.carbos}
          meta={plan.carbos_g}
          color="bg-amber-600"
        />
        <MacroBar
          etiqueta="Grasa"
          valor={totales.grasa}
          meta={plan.grasa_g}
          color="bg-violet-600"
        />
      </div>
    </section>
  );
}

function Anillo({
  valor,
  meta,
  children,
}: {
  valor: number;
  meta: number;
  children: React.ReactNode;
}) {
  const radio = 70;
  const circunferencia = 2 * Math.PI * radio;
  const progreso = meta > 0 ? Math.min(valor / meta, 1) : 0;

  return (
    <div
      className="relative h-40 w-40"
      role="img"
      aria-label={`${valor} de ${meta} kilocalorías consumidas`}
    >
      <svg viewBox="0 0 160 160" className="-rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={radio} fill="none" stroke="#e7e5e4" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={radio}
          fill="none"
          stroke="#065f46"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - progreso)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function MacroBar({
  etiqueta,
  valor,
  meta,
  color,
}: {
  etiqueta: string;
  valor: number;
  meta: number;
  color: string;
}) {
  const porcentaje = meta > 0 ? Math.min((valor / meta) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] text-stone-500">{etiqueta}</span>
        <span className="font-mono text-[9px] text-emerald-950">
          {valor}/{meta}g
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-valuenow={Math.min(valor, meta)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${color}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}
