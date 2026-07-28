'use client';

import { Check, Loader2 } from 'lucide-react';

import { formatearPrecioMXN } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import type { PlanCatalogoApi, PrecioApi } from '@/services/suscripcion';

function textoDePrecio(precio: PrecioApi): string {
  const sufijo = precio.periodo === 'ANUAL' ? '/año' : '/mes';
  return `${formatearPrecioMXN(precio.centavos)}${sufijo}`;
}

type TarjetaPlanProps = {
  plan: PlanCatalogoApi;
  esActual: boolean;
  periodo: 'MENSUAL' | 'ANUAL';
  contratando: boolean;
  onContratar: (plan: PlanCatalogoApi, precio: PrecioApi) => void;
};

/** Elige el precio del periodo pedido; si el plan no lo ofrece, cae al mensual. */
function precioVisible(plan: PlanCatalogoApi, periodo: 'MENSUAL' | 'ANUAL'): PrecioApi | undefined {
  return (
    plan.precios.find((p) => p.periodo === periodo) ??
    plan.precios.find((p) => p.periodo === 'MENSUAL')
  );
}

export function TarjetaPlan({
  plan,
  esActual,
  periodo,
  contratando,
  onContratar,
}: TarjetaPlanProps) {
  const precio = precioVisible(plan, periodo);
  const destacado = plan.clave === 'PRO';

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col ${
        esActual
          ? 'border-emerald-700 bg-emerald-50/60'
          : destacado
            ? 'border-emerald-300 bg-white'
            : 'border-stone-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-emerald-950 font-medium">{plan.nombre}</h3>
        {esActual && (
          <span className="text-[11px] uppercase tracking-wide bg-emerald-900 text-lime-300 rounded-full px-2 py-0.5">
            Tu plan
          </span>
        )}
      </div>

      <div className="mt-2 text-2xl text-emerald-950 font-medium">
        {precio ? textoDePrecio(precio) : '—'}
      </div>
      {precio && periodo === 'ANUAL' && precio.periodo === 'MENSUAL' && (
        <div className="text-xs text-stone-400 mt-0.5">Este plan solo se cobra por mes.</div>
      )}
      <p className="text-sm text-stone-500 mt-2 leading-relaxed">{plan.descripcion}</p>

      <ul className="mt-4 space-y-2 flex-1">
        {plan.incluye.map((linea) => (
          <li key={linea} className="flex items-start gap-2 text-sm text-stone-600">
            <Check size={15} className="text-emerald-700 mt-0.5 shrink-0" /> {linea}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {esActual ? (
          <div className="text-xs text-stone-400 text-center py-2">Plan vigente</div>
        ) : plan.contratable && precio ? (
          <Btn
            className="w-full justify-center"
            variant={destacado ? 'primary' : 'outline'}
            disabled={contratando}
            onClick={() => onContratar(plan, precio)}
          >
            {contratando && <Loader2 size={15} className="animate-spin" />}
            {plan.dias_prueba > 0
              ? `Probar ${plan.dias_prueba} días gratis`
              : `Contratar ${plan.nombre}`}
          </Btn>
        ) : (
          <div className="text-xs text-stone-400 text-center py-2">
            {plan.clave === 'FREE' ? 'Es el plan base de toda cuenta' : 'Próximamente'}
          </div>
        )}
      </div>
    </div>
  );
}
