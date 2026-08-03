'use client';

import { Camera, Sparkles, Trash2 } from 'lucide-react';

import type { RegistroComidaHoy } from './types';
import { useBorrarRegistro } from './useHoy';

export function RegistrosDia({ registros }: { registros: RegistroComidaHoy[] }) {
  const borrar = useBorrarRegistro();
  const libres = registros.filter((registro) => !registro.meal_plan_meal_id);
  if (libres.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="mb-2 px-5 font-display text-lg text-emerald-950">Registrado por ti</h2>
      <div className="mx-5 space-y-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
        {libres.map((registro) => (
          <article
            key={registro.id}
            className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3"
          >
            {registro.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={registro.foto_url}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span
                className={`rounded-xl p-3 ${
                  registro.origen === 'IA'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'
                }`}
              >
                {registro.origen === 'IA' ? (
                  <Sparkles size={18} aria-hidden />
                ) : (
                  <Camera size={18} aria-hidden />
                )}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-emerald-950">
                {registro.nombre}
              </span>
              <span className="block text-[11px] text-stone-400">
                {registro.calorias !== null ? `${registro.calorias} kcal` : 'Sin estimación'}
                {registro.origen === 'IA' ? ' · estimado con IA' : ''}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Eliminar ${registro.nombre}`}
              disabled={borrar.isPending}
              onClick={() => borrar.mutate(registro.id)}
              className="rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </article>
        ))}
      </div>
      {borrar.isError && (
        <p role="alert" className="mx-5 mt-2 text-center text-xs text-red-700 lg:mx-0">
          {borrar.error.message}
        </p>
      )}
    </section>
  );
}
