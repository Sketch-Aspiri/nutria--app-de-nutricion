'use client';

import {
  CopyPlus,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useState } from 'react';

import { objetivoDesdeDb } from '@nutria/shared';

import { TemplateEditorModal } from '@/components/planes/TemplateEditorModal';
import { Btn } from '@/components/ui/Btn';
import {
  useActualizarPlantilla,
  useCrearPlantilla,
  useEliminarPlantilla,
  usePlantillasPlanes,
} from '@/hooks/usePlanes';
import type {
  GuardarPlantillaPayload,
  PlantillaPlanApi,
} from '@/services/planes';

export default function PlantillasPage() {
  const { plantillas, cargando, error } = usePlantillasPlanes();
  const crear = useCrearPlantilla();
  const actualizar = useActualizarPlantilla();
  const eliminar = useEliminarPlantilla();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<PlantillaPlanApi | null>(null);

  const guardar = (payload: GuardarPlantillaPayload) => {
    if (editando) {
      actualizar.mutate(
        { id: editando.id, cambios: payload },
        { onSuccess: () => setEditando(null) },
      );
      return;
    }
    crear.mutate(payload, { onSuccess: () => setCreando(false) });
  };

  const enCurso = crear.isPending || actualizar.isPending;
  const errorGuardado = (editando ? actualizar.error : crear.error)?.message ?? null;

  return (
    <div className="max-w-5xl p-4 sm:p-6 lg:p-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <LayoutTemplate size={13} /> Biblioteca clínica
          </div>
          <h1 className="font-display text-2xl font-medium text-emerald-950 sm:text-3xl">
            Plantillas de planes
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
            Estructuras reutilizables con alimentos, porciones y snapshots nutrimentales.
          </p>
        </div>
        <Btn onClick={() => setCreando(true)}>
          <Plus size={16} /> Nueva plantilla
        </Btn>
      </header>

      {cargando && (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-5 text-sm text-stone-400">
          <Loader2 size={16} className="animate-spin" /> Cargando biblioteca…
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          No pudimos cargar las plantillas. {error.message}
        </p>
      )}

      {!cargando && !error && plantillas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
          <CopyPlus size={24} className="mx-auto mb-3 text-emerald-700" />
          <h2 className="font-display text-xl font-medium text-emerald-950">
            Tu biblioteca está vacía
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-stone-500">
            Crea una estructura aquí o guarda como plantilla un plan que ya funciona en consulta.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plantillas.map((plantilla, indice) => {
          const comidas = plantilla.estructura.comidas.length;
          const items = plantilla.estructura.comidas.reduce(
            (total, comida) => total + comida.items.length,
            0,
          );

          return (
            <article
              key={plantilla.id}
              className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_rgba(6,78,59,0.07)]"
            >
              <span className="absolute right-4 top-3 font-mono text-4xl text-stone-100" aria-hidden>
                {String(indice + 1).padStart(2, '0')}
              </span>
              <div className="relative">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <Utensils size={16} />
                </div>
                <h2 className="pr-10 font-display text-lg font-medium text-emerald-950">
                  {plantilla.nombre}
                </h2>
                <p className="mt-1 text-xs text-stone-400">
                  {objetivoDesdeDb(plantilla.objetivo)}
                </p>
                {plantilla.descripcion && (
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-stone-500">
                    {plantilla.descripcion}
                  </p>
                )}
                <div className="mt-5 grid grid-cols-3 border-y border-stone-100 py-3 text-center">
                  <div>
                    <div className="font-mono text-sm text-emerald-950">{plantilla.calorias}</div>
                    <div className="text-[10px] uppercase tracking-wide text-stone-400">kcal</div>
                  </div>
                  <div className="border-x border-stone-100">
                    <div className="font-mono text-sm text-emerald-950">{comidas}</div>
                    <div className="text-[10px] uppercase tracking-wide text-stone-400">comidas</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm text-emerald-950">{items}</div>
                    <div className="text-[10px] uppercase tracking-wide text-stone-400">items</div>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(plantilla)}
                    aria-label={`Editar ${plantilla.nombre}`}
                    className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-emerald-800"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar la plantilla “${plantilla.nombre}”?`)) {
                        eliminar.mutate(plantilla.id);
                      }
                    }}
                    disabled={eliminar.isPending}
                    aria-label={`Eliminar ${plantilla.nombre}`}
                    className="rounded-lg p-2 text-stone-300 hover:bg-orange-50 hover:text-orange-600 disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {eliminar.error && (
        <p role="alert" className="mt-4 text-xs text-orange-600">
          {eliminar.error.message}
        </p>
      )}

      {(creando || editando) && (
        <TemplateEditorModal
          key={editando?.id ?? 'nueva'}
          plantilla={editando ?? undefined}
          guardando={enCurso}
          error={errorGuardado}
          onSave={guardar}
          onClose={() => {
            setCreando(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}
