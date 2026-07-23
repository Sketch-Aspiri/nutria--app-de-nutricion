'use client';

import { LayoutTemplate, Loader2 } from 'lucide-react';

import { objetivoDesdeDb } from '@nutria/shared';

import { Modal, ModalHeader } from '@/components/ui/Modal';
import type { PlantillaPlanApi } from '@/services/planes';

type TemplatePickerProps = {
  plantillas: PlantillaPlanApi[];
  cargando: boolean;
  aplicando: boolean;
  error: string | null;
  onApply: (plantilla: PlantillaPlanApi) => void;
  onClose: () => void;
};

export function TemplatePicker({
  plantillas,
  cargando,
  aplicando,
  error,
  onApply,
  onClose,
}: TemplatePickerProps) {
  return (
    <Modal>
      <div className="p-6">
        <ModalHeader title="Aplicar plantilla" onClose={onClose} />
        <p className="-mt-2 mb-4 text-sm text-stone-500">
          Se creará un borrador independiente; la plantilla original no cambia.
        </p>

        {cargando && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-400">
            <Loader2 size={16} className="animate-spin" /> Cargando plantillas…
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
            {error}
          </p>
        )}

        {!cargando && plantillas.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center">
            <LayoutTemplate size={22} className="mx-auto mb-2 text-stone-300" />
            <p className="text-sm text-stone-500">Todavía no tienes plantillas.</p>
            <p className="mt-1 text-xs text-stone-400">
              Puedes guardar una desde cualquier plan.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          {plantillas.map((plantilla) => {
            const comidas = plantilla.estructura.comidas.length;
            const alimentos = plantilla.estructura.comidas.reduce(
              (total, comida) => total + comida.items.length,
              0,
            );

            return (
              <button
                type="button"
                key={plantilla.id}
                onClick={() => onApply(plantilla)}
                disabled={aplicando}
                className="group w-full rounded-xl border border-stone-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display font-medium text-emerald-950">
                      {plantilla.nombre}
                    </div>
                    <div className="mt-1 text-xs text-stone-400">
                      {objetivoDesdeDb(plantilla.objetivo)} · {comidas} comidas · {alimentos}{' '}
                      alimentos
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-emerald-800">
                    {plantilla.calorias} kcal
                  </span>
                </div>
                {plantilla.descripcion && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500">
                    {plantilla.descripcion}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
