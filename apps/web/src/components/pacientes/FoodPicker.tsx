'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { CATEGORIAS_ALIMENTO, filtrarAlimentos, type Alimento } from '@nutria/shared';

import { Chip } from '@/components/ui/Chip';
import { Modal, ModalHeader } from '@/components/ui/Modal';

type FoodPickerProps = {
  onAdd: (a: Alimento) => void;
  onClose: () => void;
};

export function FoodPicker({ onAdd, onClose }: FoodPickerProps) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const filtrados = filtrarAlimentos(q, cat);

  return (
    <Modal>
      <div className="p-6">
        <ModalHeader title="Base de alimentos y equivalencias" onClose={onClose} />
        <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 py-2 mb-3">
          <Search size={15} className="text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar alimento..."
            className="text-sm flex-1 focus:outline-none bg-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip label="Todas" active={cat === 'Todas'} onClick={() => setCat('Todas')} />
          {CATEGORIAS_ALIMENTO.map((c) => (
            <Chip key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
          ))}
        </div>
        <div className="max-h-72 overflow-auto divide-y divide-stone-100">
          {filtrados.map((a) => (
            <div key={a.nombre} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm text-emerald-950">{a.nombre}</div>
                <div className="text-xs text-stone-400">
                  {a.porcion} · {a.cat}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-stone-400">
                  {a.kcal} kcal · P{a.prot} C{a.carb} G{a.gras}
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(a)}
                  className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-1.5"
                  aria-label={`Agregar ${a.nombre}`}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="text-sm text-stone-400 py-6 text-center">Sin resultados.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
