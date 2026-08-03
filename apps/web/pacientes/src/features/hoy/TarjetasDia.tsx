'use client';

import { CheckCircle2, Droplet, Minus, Plus } from 'lucide-react';

import { useGuardarAgua } from './useHoy';
import type { ResumenHoy } from './types';

export function TarjetasDia({ resumen }: { resumen: ResumenHoy }) {
  const agua = useGuardarAgua();
  const cambiarAgua = (vasos: number) => {
    agua.mutate({
      fecha: resumen.dia,
      vasos: Math.max(0, Math.min(30, vasos)),
    });
  };
  const porcentajeAgua =
    resumen.agua.meta > 0 ? Math.min((resumen.agua.vasos / resumen.agua.meta) * 100, 100) : 0;

  return (
    <div className="mx-5 mt-3 grid grid-cols-2 gap-3 lg:mx-0">
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Droplet size={16} className="text-sky-600" aria-hidden />
          <h2 className="text-xs text-stone-500">Agua</h2>
        </div>
        <p className="mt-2 font-mono text-lg text-emerald-950">
          {resumen.agua.vasos}/{resumen.agua.meta}{' '}
          <span className="font-sans text-[10px] text-stone-400">vasos</span>
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          aria-label="Meta de agua"
          aria-valuemin={0}
          aria-valuemax={resumen.agua.meta}
          aria-valuenow={Math.min(resumen.agua.vasos, resumen.agua.meta)}
        >
          <div
            className="h-full rounded-full bg-sky-500 transition-[width]"
            style={{ width: `${porcentajeAgua}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <BotonAgua
            etiqueta="Quitar un vaso"
            onClick={() => cambiarAgua(resumen.agua.vasos - 1)}
            disabled={agua.isPending || resumen.agua.vasos === 0}
          >
            <Minus size={14} aria-hidden />
          </BotonAgua>
          <BotonAgua
            etiqueta="Agregar un vaso"
            onClick={() => cambiarAgua(resumen.agua.vasos + 1)}
            disabled={agua.isPending || resumen.agua.vasos === 30}
          >
            <Plus size={14} aria-hidden />
          </BotonAgua>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-700" aria-hidden />
          <h2 className="text-xs text-stone-500">Adherencia</h2>
        </div>
        {resumen.adherencia ? (
          <>
            <p className="mt-2 font-mono text-lg text-emerald-950">
              {resumen.adherencia.porcentaje}%
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200"
              role="progressbar"
              aria-label="Adherencia al plan"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={resumen.adherencia.porcentaje}
            >
              <div
                className="h-full rounded-full bg-emerald-700 transition-[width]"
                style={{ width: `${resumen.adherencia.porcentaje}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] leading-snug text-stone-400">
              {resumen.adherencia.comidas_registradas} de {resumen.adherencia.comidas_esperadas}{' '}
              comidas · {resumen.adherencia.dias_evaluados} días
            </p>
          </>
        ) : (
          <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
            Se calcula cuando tengas un plan compartido.
          </p>
        )}
      </section>

      {(agua.isError || agua.isSuccess) && (
        <p
          role={agua.isError ? 'alert' : 'status'}
          className={`col-span-2 text-center text-[11px] ${
            agua.isError ? 'text-red-700' : 'text-emerald-700'
          }`}
        >
          {agua.isError ? agua.error.message : `Agua actualizada: ${resumen.agua.vasos} vasos.`}
        </p>
      )}
    </div>
  );
}

function BotonAgua({
  etiqueta,
  onClick,
  disabled,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-sky-50 p-2 text-sky-700 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
