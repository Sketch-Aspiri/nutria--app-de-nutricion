'use client';

import { Loader2, Scale } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass, labelClass } from '@/components/ui/campos';

import { useRegistrarPeso } from '../useRegistro';
import { ErrorFormulario } from './error';

export function FormPeso({
  dia,
  onAtras,
  onHecho,
}: {
  dia: string;
  onAtras: () => void;
  onHecho: () => void;
}) {
  const [peso, setPeso] = useState('');
  const guardar = useRegistrarPeso();

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    try {
      await guardar.mutateAsync({ fecha: dia, pesoKg: Number(peso) });
      onHecho();
    } catch {
      // React Query expone el error sin desmontar ni vaciar el formulario.
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <button type="button" onClick={onAtras} className="text-xs text-stone-500">
        ← Volver a opciones
      </button>
      <div>
        <label htmlFor="peso-hoy" className={labelClass}>
          Tu peso de hoy
        </label>
        <div className="relative">
          <input
            id="peso-hoy"
            type="number"
            inputMode="decimal"
            min={20}
            max={400}
            step="0.1"
            required
            value={peso}
            onChange={(evento) => setPeso(evento.target.value)}
            placeholder="68.0"
            className={`${inputClass} pr-14 font-mono text-xl text-emerald-950`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-stone-400">
            kg
          </span>
        </div>
      </div>
      <ErrorFormulario error={guardar.error} />
      <Btn type="submit" disabled={guardar.isPending || !peso} className="w-full">
        {guardar.isPending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Scale size={16} aria-hidden />
        )}
        Guardar peso
      </Btn>
    </form>
  );
}
