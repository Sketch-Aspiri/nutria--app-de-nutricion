'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import {
  OBJETIVOS,
  objetivoADb,
  objetivoDesdeDb,
  type ObjetivoDb,
} from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass, labelClass } from '@/components/ui/campos';

type SaveTemplateModalProps = {
  objetivoInicial: ObjetivoDb;
  calorias: number;
  guardando: boolean;
  error: string | null;
  onSave: (datos: {
    nombre: string;
    objetivo: ObjetivoDb;
    calorias: number;
    descripcion: string | null;
  }) => void;
  onClose: () => void;
};

export function SaveTemplateModal({
  objetivoInicial,
  calorias,
  guardando,
  error,
  onSave,
  onClose,
}: SaveTemplateModalProps) {
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState(objetivoInicial);
  const [descripcion, setDescripcion] = useState('');

  return (
    <Modal>
      <form
        className="p-4 sm:p-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          onSave({
            nombre: nombre.trim(),
            objetivo,
            calorias,
            descripcion: descripcion.trim() || null,
          });
        }}
      >
        <ModalHeader title="Guardar como plantilla" onClose={onClose} />
        <p className="-mt-2 mb-4 text-sm text-stone-500">
          Conservaremos comidas, alimentos, porciones e indicaciones como una copia reutilizable.
        </p>
        <div className="space-y-3">
          <label className={labelClass}>
            Nombre
            <input
              autoFocus
              required
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Ej. Días de entrenamiento · 2,100 kcal"
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className={labelClass}>
            Objetivo
            <select
              value={objetivo}
              onChange={(evento) => setObjetivo(evento.target.value as ObjetivoDb)}
              className={`${inputClass} mt-1`}
            >
              {OBJETIVOS.map((opcion) => {
                const valor = objetivoADb(opcion);
                return (
                  <option key={valor} value={valor}>
                    {objetivoDesdeDb(valor)}
                  </option>
                );
              })}
            </select>
          </label>
          <label className={labelClass}>
            Nota de uso
            <textarea
              value={descripcion}
              onChange={(evento) => setDescripcion(evento.target.value)}
              rows={2}
              placeholder="Cuándo conviene usarla o qué ajustes requiere."
              className={`${inputClass} mt-1 resize-y`}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-orange-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </Btn>
          <Btn type="submit" disabled={guardando || !nombre.trim()}>
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Guardar plantilla
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
