'use client';

import { CalendarPlus, Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';

import type { NutriologaAdmin } from '@/services/superadmin';

type FilaNutriologaProps = {
  nutriologa: NutriologaAdmin;
  activando: boolean;
  onActivar: (id: string, nota: string, listo: () => void) => void;
};

function fecha(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function FilaNutriologa({ nutriologa, activando, onActivar }: FilaNutriologaProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [nota, setNota] = useState('');
  const activa = nutriologa.estado_cuenta === 'ACTIVA';

  const formulario = confirmando ? (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
      <label
        className="block text-xs font-medium text-emerald-950"
        htmlFor={`nota-${nutriologa.id}`}
      >
        Nota de pago <span className="font-normal text-stone-400">(opcional)</span>
      </label>
      <input
        id={`nota-${nutriologa.id}`}
        value={nota}
        maxLength={300}
        onChange={(evento) => setNota(evento.target.value)}
        placeholder="Ej. depósito confirmado"
        className="mt-2 w-full rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
      />
      <p className="mt-2 text-xs leading-relaxed text-stone-500">
        La nueva vigencia contará un mes desde este momento.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-700">
        No incluyas números de cuenta, referencias completas ni otros datos bancarios.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={activando}
          onClick={() => onActivar(nutriologa.id, nota, () => setConfirmando(false))}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-900 disabled:opacity-60"
        >
          {activando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Confirmar 1 mes
        </button>
        <button
          type="button"
          disabled={activando}
          onClick={() => setConfirmando(false)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs text-stone-500 hover:bg-white"
        >
          <X size={14} /> Cancelar
        </button>
      </div>
    </div>
  ) : nutriologa.gestionada_por_stripe ? (
    <span className="inline-flex rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500">
      Gestionada en Stripe
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 px-3 py-2 text-xs font-medium text-emerald-900 transition hover:bg-emerald-950 hover:text-white"
    >
      <CalendarPlus size={15} /> Activar 1 mes
    </button>
  );

  return (
    <article className="border-b border-stone-200 px-4 py-5 last:border-b-0 sm:px-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(210px,1.4fr)_150px_150px_minmax(210px,1fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-medium text-emerald-950">{nutriologa.nombre}</h2>
            {nutriologa.primer_mes_gratis && (
              <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                Primer mes gratis
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-stone-500">{nutriologa.email}</p>
          <p className="mt-2 text-xs text-stone-400">
            Registro: {fecha(nutriologa.fecha_registro)}
          </p>
        </div>

        <div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
              activa ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${activa ? 'bg-emerald-600' : 'bg-rose-600'}`}
            />
            {activa ? 'Activa' : 'Bloqueada'}
          </span>
          <p className="mt-2 text-xs text-stone-500">Hasta {fecha(nutriologa.acceso_expira)}</p>
        </div>

        <div>
          <p className="font-display text-lg text-emerald-950">
            {nutriologa.plan === 'PRO' ? 'Pro' : nutriologa.plan}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {nutriologa.ultima_activacion
              ? `Activada ${fecha(nutriologa.ultima_activacion)}`
              : 'Sin activación manual'}
          </p>
        </div>

        <div>
          {formulario}
          {!confirmando && nutriologa.nota_activacion && (
            <p className="mt-2 line-clamp-2 text-xs text-stone-400">{nutriologa.nota_activacion}</p>
          )}
        </div>
      </div>
    </article>
  );
}
