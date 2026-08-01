'use client';

import { ChevronLeft, Flame, Users } from 'lucide-react';
import Link from 'next/link';

import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';

import { caloriasPorPorcion, ingredientesDeReceta, pasosDeReceta } from './calculos';
import { SustituirIngrediente } from './SustituirIngrediente';
import { useRecetas } from './usePlan';
import type { Receta } from './types';

/**
 * Detalle de una receta enviada.
 *
 * Se resuelve desde el listado de `/me/recipes` en vez de pedir un endpoint por
 * id: ese listado solo trae recetas enviadas al paciente de la sesión, así que
 * un id ajeno o el de un borrador simplemente no aparece y la pantalla dice que
 * no existe. No hay forma de que la URL filtre contenido de otro paciente.
 */
export function RecetaDetalle({ recetaId }: { recetaId: string }) {
  const recetas = useRecetas();

  if (recetas.isPending) {
    return (
      <Envoltorio titulo="Receta">
        <Cargando etiqueta="Cargando la receta" />
      </Envoltorio>
    );
  }

  if (recetas.isError) {
    return (
      <Envoltorio titulo="Receta">
        <ErrorDeCarga titulo="No pudimos cargar la receta" onReintentar={() => recetas.refetch()} />
      </Envoltorio>
    );
  }

  const receta = recetas.data.find((candidata) => candidata.id === recetaId);
  if (!receta) {
    return (
      <Envoltorio titulo="Receta no disponible">
        <div className="mx-5 rounded-3xl border border-stone-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-emerald-950">Esta receta ya no está disponible</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Tu nutrióloga pudo haberla retirado. Revisa las que tienes en tu plan.
          </p>
          <Link
            href="/plan?vista=recetas"
            className="mt-4 inline-block text-xs font-medium text-emerald-800 underline"
          >
            Ver mis recetas
          </Link>
        </div>
      </Envoltorio>
    );
  }

  return (
    <Envoltorio titulo={receta.nombre}>
      <Encabezado receta={receta} />
      <Ingredientes receta={receta} />
      <Preparacion receta={receta} />
      <SustituirIngrediente receta={receta} />
    </Envoltorio>
  );
}

/**
 * Marco del detalle: título y vuelta a la lista.
 *
 * La flecha es un `Link`, no un `history.back()`: si el paciente abrió la receta
 * desde un enlace compartido, atrás lo sacaría de la app.
 */
function Envoltorio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen pb-nav">
      <header className="flex items-center gap-2 px-5 pb-4 pt-8">
        <Link
          href="/plan?vista=recetas"
          aria-label="Volver a mis recetas"
          className="-ml-1 rounded-full p-1 text-stone-500"
        >
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <h1 className="font-display text-xl font-medium leading-tight text-emerald-950">
          {titulo}
        </h1>
      </header>
      {children}
    </main>
  );
}

function Encabezado({ receta }: { receta: Receta }) {
  const porPorcion = caloriasPorPorcion(receta);

  return (
    <p className="mx-5 mb-3 flex flex-wrap gap-3 text-xs text-stone-500">
      <span className="flex items-center gap-1">
        <Users size={13} aria-hidden />
        {receta.porciones} {receta.porciones === 1 ? 'porción' : 'porciones'}
      </span>
      {porPorcion !== null && (
        <span className="flex items-center gap-1 font-mono">
          <Flame size={13} aria-hidden />
          {porPorcion} kcal por porción
        </span>
      )}
    </p>
  );
}

function Ingredientes({ receta }: { receta: Receta }) {
  const ingredientes = ingredientesDeReceta(receta);

  return (
    <section className="mx-5 rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-stone-400">Ingredientes</h2>
      {ingredientes.length === 0 ? (
        <p className="text-sm text-stone-500">
          Esta receta no tiene ingredientes capturados. Pregúntale a tu nutrióloga.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {ingredientes.map((ingrediente, indice) => (
            <li
              // Un ingrediente puede repetirse ("sal", al principio y al final):
              // el índice es lo único estable, y la lista no se reordena.
              key={`${indice}-${ingrediente}`}
              className="flex items-start gap-2 text-sm text-stone-700"
            >
              <span aria-hidden className="mt-1 text-emerald-600">
                •
              </span>
              {ingrediente}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Preparacion({ receta }: { receta: Receta }) {
  const pasos = pasosDeReceta(receta);
  if (pasos.length === 0) return null;

  return (
    <section className="mx-5 mt-3 rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-xs uppercase tracking-wide text-stone-400">Preparación</h2>
      <ol className="space-y-2.5">
        {pasos.map((paso, indice) => (
          <li
            key={`${indice}-${paso}`}
            className="flex gap-2.5 text-sm leading-relaxed text-stone-700"
          >
            <span aria-hidden className="shrink-0 font-mono text-emerald-700">
              {indice + 1}.
            </span>
            {paso}
          </li>
        ))}
      </ol>
    </section>
  );
}
