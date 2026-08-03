'use client';

import { ChefHat, Flame, Sparkles, Utensils } from 'lucide-react';
import Link from 'next/link';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { EstadoVacio } from '@/components/ui/Pantalla';

import { caloriasPorPorcion, ingredientesDeReceta } from './calculos';
import { useRecetas } from './usePlan';
import type { Receta } from './types';

/**
 * Recetas que la nutrióloga envió.
 *
 * El endpoint filtra por `estado = ENVIADA`, así que aquí no hay ninguna
 * decisión sobre visibilidad: lo que llega, llega porque ella lo envió. Un
 * borrador suyo no existe para esta pantalla.
 */
export function ListaRecetas() {
  const recetas = useRecetas();

  if (recetas.isPending) return <Cargando etiqueta="Cargando tus recetas" />;
  if (recetas.isError) {
    return (
      <ErrorDeCarga titulo="No pudimos cargar tus recetas" onReintentar={() => recetas.refetch()} />
    );
  }
  if (recetas.data.length === 0) {
    return (
      <EstadoVacio
        icono={Utensils}
        titulo="Todavía no tienes recetas"
        descripcion="Cuando tu nutrióloga te envíe una, la verás aquí con sus ingredientes y su preparación."
      />
    );
  }

  return (
    <ul className="mx-5 space-y-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {recetas.data.map((receta) => (
        <li key={receta.id}>
          <TarjetaReceta receta={receta} />
        </li>
      ))}
    </ul>
  );
}

function TarjetaReceta({ receta }: { receta: Receta }) {
  const porPorcion = caloriasPorPorcion(receta);
  const ingredientes = ingredientesDeReceta(receta).length;

  return (
    <Link
      href={`/plan/recetas/${receta.id}`}
      className="block rounded-2xl border border-stone-200 bg-white p-4 transition-colors active:border-emerald-300"
    >
      <span className="flex items-center gap-2">
        <ChefHat size={16} className="shrink-0 text-emerald-800" aria-hidden />
        <span className="text-sm font-medium text-emerald-950">{receta.nombre}</span>
        {receta.origen === 'IA' && (
          <span
            title="Propuesta con IA y revisada por tu nutrióloga"
            className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
          >
            <Sparkles size={9} aria-hidden />
            IA
          </span>
        )}
      </span>
      <span className="mt-1 flex gap-3 text-[11px] text-stone-400">
        {porPorcion !== null && (
          <span className="flex items-center gap-1 font-mono">
            <Flame size={11} aria-hidden />
            {porPorcion} kcal por porción
          </span>
        )}
        <span>
          {ingredientes} {ingredientes === 1 ? 'ingrediente' : 'ingredientes'}
        </span>
      </span>
    </Link>
  );
}
