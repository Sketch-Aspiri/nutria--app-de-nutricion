'use client';

import Link from 'next/link';

import { ETIQUETA_PLAN } from '@/components/suscripcion/formato';
import { useSuscripcion } from '@/hooks/useSuscripcion';

/**
 * Badge de plan del encabezado. Antes era un modal decorativo con datos
 * inventados; ahora lee la suscripción real y lleva a `/suscripcion`, que es
 * donde se gestiona.
 *
 * El color del punto resume el estado sin obligar a leer: verde todo en orden,
 * ámbar algo que atender (pago pendiente o cuota casi agotada), rojo un tope ya
 * alcanzado.
 */

type Tono = 'ok' | 'atencion' | 'alto';

const COLOR_PUNTO: Record<Tono, string> = {
  ok: 'bg-lime-500',
  atencion: 'bg-amber-500',
  alto: 'bg-red-500',
};

export function TopBar() {
  const suscripcion = useSuscripcion();
  const datos = suscripcion.data;

  const etiqueta = datos ? (ETIQUETA_PLAN[datos.plan] ?? datos.plan) : '…';
  const beta = datos?.modo === 'beta';
  const ia = datos?.entitlements.ia;

  const tono: Tono = !datos
    ? 'ok'
    : datos.estado === 'PAST_DUE' || datos.estado === 'UNPAID'
      ? 'atencion'
      : ia?.agotada || datos.entitlements.pacientes.alcanzado
        ? 'alto'
        : cercaDelLimite(ia?.usadas, ia?.limite)
          ? 'atencion'
          : 'ok';

  return (
    <div className="flex justify-end items-center gap-3 px-8 py-4 border-b border-stone-200 bg-white shrink-0">
      {datos && !beta && ia && ia.limite !== null && (
        <span className="text-xs text-stone-400 hidden sm:inline">
          {ia.restantes} generaciones de IA restantes
        </span>
      )}
      <Link
        href="/suscripcion"
        className="flex items-center gap-2 bg-white border border-stone-200 rounded-full pl-3 pr-4 py-1.5 text-xs hover:border-emerald-300 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${COLOR_PUNTO[tono]}`} />
        <span className="text-stone-600">
          Plan <span className="font-semibold text-emerald-900">{etiqueta}</span>
          {beta && <span className="text-stone-400"> · beta</span>}
        </span>
      </Link>
    </div>
  );
}

/** A partir del 80 % consumido conviene avisar, no cuando ya no queda nada. */
function cercaDelLimite(usadas?: number, limite?: number | null): boolean {
  if (usadas === undefined || limite === null || limite === undefined || limite <= 0) return false;
  return usadas / limite >= 0.8;
}
