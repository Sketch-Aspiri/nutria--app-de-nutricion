'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { useSustituirIngrediente } from './usePlan';
import type { Receta } from './types';

/**
 * "No tengo este ingrediente": la IA propone un equivalente.
 *
 * Tres cosas que el prototipo hacía y aquí no: armaba el prompt en el
 * navegador, mandaba el nombre de la receta y el objetivo del paciente al
 * modelo desde el cliente, y presentaba la respuesta como si fuera un cambio a
 * la receta. Aquí el servidor arma el prompt y seudonimiza; el cliente solo
 * manda el ingrediente y el `receta_id`, y la sugerencia se muestra como
 * sugerencia: no se guarda ni altera lo que la nutrióloga aprobó.
 */
export function SustituirIngrediente({ receta }: { receta: Receta }) {
  const [ingrediente, setIngrediente] = useState('');
  const sustituir = useSustituirIngrediente();

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const limpio = ingrediente.trim();
    if (limpio.length < 2 || sustituir.isPending) return;
    sustituir.mutate({ ingrediente: limpio, receta_id: receta.id });
  };

  const sugerencia = sustituir.data;

  return (
    <section className="mx-5 mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-emerald-900">
        <Sparkles size={16} aria-hidden />
        ¿No tienes un ingrediente?
      </h2>

      <form onSubmit={enviar} className="mt-2 flex gap-2">
        <label htmlFor="ingrediente-a-sustituir" className="sr-only">
          Ingrediente que quieres cambiar
        </label>
        <input
          id="ingrediente-a-sustituir"
          value={ingrediente}
          onChange={(evento) => setIngrediente(evento.target.value)}
          maxLength={120}
          placeholder="Ej. crema de cacahuate"
          className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-base focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sustituir.isPending || ingrediente.trim().length < 2}
          className="shrink-0 rounded-xl bg-emerald-900 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {sustituir.isPending ? (
            <Loader2 size={16} className="animate-spin" aria-label="Buscando alternativa" />
          ) : (
            'Sustituir'
          )}
        </button>
      </form>

      {sustituir.isError && (
        <p role="alert" className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs text-red-800">
          {sustituir.error.message}
        </p>
      )}

      {sugerencia && (
        // `aria-live` porque la respuesta aparece sin que el foco se mueva: quien
        // usa lector de pantalla no tiene otra forma de enterarse de que llegó.
        <div aria-live="polite" className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
          <p className="text-sm font-medium text-emerald-950">{sugerencia.datos.sustituto}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{sugerencia.datos.razon}</p>
          <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-relaxed text-stone-400">
            {sugerencia.aviso}
          </p>
          <p className="mt-1 font-mono text-[10px] text-stone-400">
            Te quedan {sugerencia.cuota.restantes} de {sugerencia.cuota.limite} consultas este mes.
          </p>
        </div>
      )}
    </section>
  );
}
