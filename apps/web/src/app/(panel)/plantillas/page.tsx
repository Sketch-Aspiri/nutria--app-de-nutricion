'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { OBJETIVOS, type Objetivo } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { useAppState } from '@/store/app-state';

const FORM_INICIAL = {
  nombre: '',
  objetivo: 'Pérdida de grasa' as Objetivo,
  calorias: '1600',
  descripcion: '',
};

export default function PlantillasPage() {
  const { plantillas, setPlantillas } = useAppState();
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);

  const crear = () => {
    setPlantillas((p) => [
      ...p,
      {
        id: Date.now(),
        nombre: form.nombre,
        objetivo: form.objetivo,
        calorias: Number(form.calorias) || 0,
        descripcion: form.descripcion,
      },
    ]);
    setNueva(false);
    setForm(FORM_INICIAL);
  };

  const borrar = (id: number) => setPlantillas((p) => p.filter((x) => x.id !== id));

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Plantillas de planes</h1>
          <div className="text-stone-500 text-sm mt-1">Reutiliza estructuras para ahorrar tiempo</div>
        </div>
        <Btn onClick={() => setNueva(true)}>
          <Plus size={16} /> Nueva plantilla
        </Btn>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {plantillas.map((pl) => (
          <div key={pl.id} className="bg-white border border-stone-200 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="font-display text-emerald-950 font-medium">{pl.nombre}</div>
              <button
                type="button"
                onClick={() => borrar(pl.id)}
                className="text-stone-300 hover:text-orange-500"
                aria-label={`Borrar ${pl.nombre}`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-stone-400 mt-1">
              {pl.objetivo} · <span className="font-mono">{pl.calorias} kcal</span>
            </div>
            <div className="text-sm text-stone-500 mt-2">{pl.descripcion}</div>
          </div>
        ))}
      </div>
      {nueva && (
        <Modal>
          <div className="p-6">
            <ModalHeader title="Nueva plantilla" onClose={() => setNueva(false)} />
            <div className="space-y-3">
              <div>
                <label className={lbl}>Nombre</label>
                <input
                  className={inp}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. Déficit moderado — vegetariano"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Objetivo</label>
                  <select
                    className={inp}
                    value={form.objetivo}
                    onChange={(e) => setForm({ ...form, objetivo: e.target.value as Objetivo })}
                  >
                    {OBJETIVOS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Calorías</label>
                  <input
                    type="number"
                    className={inp}
                    value={form.calorias}
                    onChange={(e) => setForm({ ...form, calorias: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={lbl}>Descripción</label>
                <textarea
                  rows={2}
                  className={inp}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn variant="ghost" onClick={() => setNueva(false)}>
                Cancelar
              </Btn>
              <Btn onClick={crear}>Guardar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
