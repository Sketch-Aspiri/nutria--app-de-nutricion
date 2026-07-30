'use client';

import { Plus } from 'lucide-react';

import type { AlimentoFicha } from '@nutria/shared';

import { BuscadorAlimentos } from '@/components/alimentos/BuscadorAlimentos';
import { Modal, ModalHeader } from '@/components/ui/Modal';

type FoodPickerProps = {
  onAdd: (alimento: AlimentoFicha) => void;
  onClose: () => void;
};

/** Selector de alimentos para armar un plan, con la base real detrás. */
export function FoodPicker({ onAdd, onClose }: FoodPickerProps) {
  return (
    <Modal wide>
      <div className="p-4 sm:p-6">
        <ModalHeader title="Base de alimentos y equivalencias" onClose={onClose} />
        <BuscadorAlimentos
          accion={(alimento) => (
            <button
              type="button"
              onClick={() => onAdd(alimento)}
              className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-1.5 shrink-0"
              aria-label={`Agregar ${alimento.nombre}`}
            >
              <Plus size={16} />
            </button>
          )}
        />
      </div>
    </Modal>
  );
}
