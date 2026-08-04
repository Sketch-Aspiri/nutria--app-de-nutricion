'use client';

import {
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react';

import { useState } from 'react';

import { useActivarNutriologa, useNutriologasAdmin } from '@/hooks/useSuperadmin';

import { FilaNutriologa } from './FilaNutriologa';

export function PanelNutriologas() {
  const [page, setPage] = useState(1);
  const consulta = useNutriologasAdmin(page);
  const activar = useActivarNutriologa();
  const nutriologas = consulta.data?.data ?? [];
  const activas = consulta.data?.meta.activas ?? 0;
  const bloqueadas = consulta.data?.meta.bloqueadas ?? 0;
  const totalPaginas = Math.max(
    Math.ceil((consulta.data?.meta.total ?? 0) / (consulta.data?.meta.per_page ?? 20)),
    1,
  );

  const manejarActivacion = (id: string, nota: string, listo: () => void) => {
    activar.mutate({ id, nota }, { onSuccess: listo });
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-emerald-950 px-5 py-7 text-white shadow-xl shadow-emerald-950/10 sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[28px] border-lime-300/10" />
        <div className="relative max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-lime-300">
            <ShieldCheck size={15} /> Control de acceso
          </div>
          <h1 className="font-display text-3xl font-medium sm:text-4xl">Ciclos de nutriólogas</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-100">
            Revisa vencimientos y confirma cada renovación manual. Una activación asigna Pro por un
            mes desde el momento de confirmación.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Resumen etiqueta="Total" valor={consulta.data?.meta.total ?? nutriologas.length} />
        <Resumen etiqueta="Activas" valor={activas} icono={UserRoundCheck} tono="verde" />
        <Resumen etiqueta="Bloqueadas" valor={bloqueadas} icono={UserRoundX} tono="rojo" />
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-display text-xl text-emerald-950">Cuentas registradas</h2>
            <p className="mt-1 text-xs text-stone-400">Ordenadas por fecha de registro</p>
          </div>
          <button
            type="button"
            onClick={() => void consulta.refetch()}
            disabled={consulta.isFetching}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-emerald-900"
            aria-label="Actualizar listado"
          >
            <RefreshCw size={17} className={consulta.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {consulta.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-stone-400">
            <Loader2 size={17} className="animate-spin" /> Cargando cuentas…
          </div>
        ) : consulta.isError ? (
          <div className="m-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} className="shrink-0" /> No pudimos cargar las cuentas. Intenta de
            nuevo.
          </div>
        ) : nutriologas.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-stone-400">
            Aún no hay nutriólogas registradas.
          </p>
        ) : (
          <>
            {nutriologas.map((nutriologa) => (
              <FilaNutriologa
                key={nutriologa.id}
                nutriologa={nutriologa}
                activando={activar.isPending && activar.variables?.id === nutriologa.id}
                onActivar={manejarActivacion}
              />
            ))}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-between border-t border-stone-200 px-4 py-4 text-sm sm:px-5">
                <button
                  type="button"
                  disabled={page === 1 || consulta.isFetching}
                  onClick={() => setPage((actual) => Math.max(actual - 1, 1))}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-stone-600 hover:border-emerald-300 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-stone-400">
                  Página {page} de {totalPaginas}
                </span>
                <button
                  type="button"
                  disabled={page === totalPaginas || consulta.isFetching}
                  onClick={() => setPage((actual) => Math.min(actual + 1, totalPaginas))}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-stone-600 hover:border-emerald-300 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {activar.isError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {activar.error.message}
        </div>
      )}
    </div>
  );
}

type ResumenProps = {
  etiqueta: string;
  valor: number;
  icono?: typeof UserRoundCheck;
  tono?: 'verde' | 'rojo';
};

function Resumen({ etiqueta, valor, icono: Icono, tono = 'verde' }: ResumenProps) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-stone-400">{etiqueta}</span>
        {Icono && (
          <Icono size={17} className={tono === 'rojo' ? 'text-rose-500' : 'text-emerald-600'} />
        )}
      </div>
      <strong className="mt-2 block font-display text-3xl font-medium text-emerald-950">
        {valor}
      </strong>
    </div>
  );
}
