'use client';

import {
  OBJETIVOS,
  objetivoADb,
  objetivoDesdeDb,
  type ObjetivoDb,
} from '@nutria/shared';

import { inputClass, labelClass } from '@/components/ui/campos';

type TemplateEditorFieldsProps = {
  nombre: string;
  objetivo: ObjetivoDb;
  calorias: number;
  descripcion: string;
  onNombreChange: (nombre: string) => void;
  onObjetivoChange: (objetivo: ObjetivoDb) => void;
  onCaloriasChange: (calorias: number) => void;
  onDescripcionChange: (descripcion: string) => void;
};

export function TemplateEditorFields({
  nombre,
  objetivo,
  calorias,
  descripcion,
  onNombreChange,
  onObjetivoChange,
  onCaloriasChange,
  onDescripcionChange,
}: TemplateEditorFieldsProps) {
  return (
    <div className="grid gap-3 border-b border-stone-200 pb-5 sm:grid-cols-2">
      <label className={labelClass}>
        Nombre
        <input
          autoFocus
          required
          value={nombre}
          onChange={(evento) => onNombreChange(evento.target.value)}
          placeholder="Ej. Menú vegetariano de consulta"
          className={`${inputClass} mt-1`}
        />
      </label>
      <label className={labelClass}>
        Objetivo
        <select
          value={objetivo}
          onChange={(evento) =>
            onObjetivoChange(evento.target.value as ObjetivoDb)
          }
          className={`${inputClass} mt-1`}
        >
          {OBJETIVOS.map((opcion) => (
            <option key={opcion} value={objetivoADb(opcion)}>
              {objetivoDesdeDb(objetivoADb(opcion))}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Energía de referencia
        <input
          type="number"
          required
          min={1}
          value={calorias || ''}
          onChange={(evento) => onCaloriasChange(Number(evento.target.value))}
          placeholder="1800"
          className={`${inputClass} mt-1`}
        />
      </label>
      <label className={labelClass}>
        Nota de uso
        <input
          value={descripcion}
          onChange={(evento) => onDescripcionChange(evento.target.value)}
          placeholder="Contexto o ajustes sugeridos"
          className={`${inputClass} mt-1`}
        />
      </label>
    </div>
  );
}
