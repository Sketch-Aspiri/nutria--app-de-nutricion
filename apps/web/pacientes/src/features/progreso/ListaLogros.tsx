import { Check, Trophy } from 'lucide-react';

import { conteoDeLogros, porcentajeDeLogro } from './calculos';
import type { Logro } from './types';

/**
 * Logros del paciente.
 *
 * Llegan calculados desde `packages/shared/src/logros.ts`: aquí no se decide si
 * uno está conseguido ni se recalcula la racha. La app solo los pinta, y por eso
 * no puede desincronizarse de lo que el paciente realmente registró.
 *
 * Los que faltan se muestran igual, con su barra de avance. Esconderlos
 * convertiría la sección en una lista de trofeos vacía el primer día; verlos
 * dice qué falta para el siguiente.
 */
export function ListaLogros({ logros }: { logros: Logro[] }) {
  const { conseguidos, total } = conteoDeLogros(logros);

  if (total === 0) {
    return (
      <section className="mx-5 mt-4 rounded-2xl border border-stone-200 bg-white p-4 lg:mx-0">
        <EncabezadoLogros conseguidos={0} total={0} />
        <p className="mt-3 text-xs leading-relaxed text-stone-400">
          Tus logros aparecerán conforme registres tus comidas, tu agua y tu peso.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-5 mt-4 rounded-2xl border border-stone-200 bg-white p-4 lg:mx-0">
      <EncabezadoLogros conseguidos={conseguidos} total={total} />
      <ul className="mt-3 space-y-3 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-3 lg:space-y-0">
        {logros.map((logro) => (
          <FilaLogro key={logro.id} logro={logro} />
        ))}
      </ul>
    </section>
  );
}

function EncabezadoLogros({ conseguidos, total }: { conseguidos: number; total: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-950">
        <Trophy size={16} className="text-emerald-800" aria-hidden />
        Tus logros
      </h2>
      {total > 0 && (
        <span className="font-mono text-xs text-stone-400">
          {conseguidos}/{total}
        </span>
      )}
    </div>
  );
}

function FilaLogro({ logro }: { logro: Logro }) {
  const porcentaje = porcentajeDeLogro(logro.progreso);

  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          logro.conseguido ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-400'
        }`}
      >
        {logro.conseguido ? <Check size={14} /> : <Trophy size={13} />}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            logro.conseguido ? 'font-medium text-emerald-950' : 'text-stone-600'
          }`}
        >
          {logro.titulo}
          {/* El estado no se codifica solo con color: se dice con palabras. */}
          {logro.conseguido && <span className="sr-only"> — conseguido</span>}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-stone-400">{logro.descripcion}</p>

        {!logro.conseguido && (
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-label={`Avance de "${logro.titulo}"`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje}
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width]"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        )}
      </div>
    </li>
  );
}
