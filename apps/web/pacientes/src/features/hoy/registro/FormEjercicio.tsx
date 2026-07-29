'use client';

import { Dumbbell, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

import { useRegistrarEjercicio } from '../useRegistro';
import { ErrorFormulario } from './error';

export function FormEjercicio({
  dia,
  onAtras,
  onHecho,
}: {
  dia: string;
  onAtras: () => void;
  onHecho: () => void;
}) {
  const [tipo, setTipo] = useState('');
  const [duracion, setDuracion] = useState('');
  const guardar = useRegistrarEjercicio();

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    try {
      await guardar.mutateAsync({
        fecha: dia,
        tipo: tipo.trim(),
        duracionMin: Number(duracion),
      });
      onHecho();
    } catch {
      // El estado de la mutación alimenta el aviso y permite reintentar.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <button type="button" onClick={onAtras} className="text-xs text-stone-500">
        ← Volver a opciones
      </button>
      <div>
        <label htmlFor="tipo-ejercicio" className={labelClass}>
          Actividad
        </label>
        <input
          id="tipo-ejercicio"
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
          minLength={1}
          maxLength={100}
          required
          placeholder="Ej. caminata rápida"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="duracion-ejercicio" className={labelClass}>
          Duración
        </label>
        <div className="relative">
          <input
            id="duracion-ejercicio"
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            required
            value={duracion}
            onChange={(evento) => setDuracion(evento.target.value)}
            placeholder="30"
            className={`${inputClass} pr-20`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-stone-400">
            minutos
          </span>
        </div>
      </div>
      <ErrorFormulario error={guardar.error} />
      <Btn
        type="submit"
        disabled={guardar.isPending || !tipo.trim() || !duracion}
        className="w-full"
      >
        {guardar.isPending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Dumbbell size={16} aria-hidden />
        )}
        Guardar ejercicio
      </Btn>
    </form>
  );
}
