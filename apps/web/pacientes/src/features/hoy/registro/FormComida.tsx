'use client';

import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { inputClass } from '@/components/ui/campos';

import type { EstimacionComida } from '../types';
import { useEstimarComida, useRegistrarComida } from '../useRegistro';
import { ErrorFormulario } from './error';

export function FormComida({ onAtras, onHecho }: { onAtras: () => void; onHecho: () => void }) {
  const [texto, setTexto] = useState('');
  const [estimacion, setEstimacion] = useState<EstimacionComida | null>(null);
  const estimar = useEstimarComida();
  const guardar = useRegistrarComida();

  const solicitarEstimacion = async (evento: React.FormEvent) => {
    evento.preventDefault();
    try {
      const respuesta = await estimar.mutateAsync(texto);
      setEstimacion(respuesta.datos);
    } catch {
      // React Query conserva el error tipado y `ErrorFormulario` lo anuncia.
    }
  };

  const confirmar = async () => {
    if (!estimacion) return;
    try {
      await guardar.mutateAsync(estimacion);
      onHecho();
    } catch {
      // El formulario permanece abierto con la estimación para reintentar.
    }
  };

  if (estimacion) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEstimacion(null)}
          className="text-xs text-stone-500"
        >
          ← Corregir descripción
        </button>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-emerald-950">{estimacion.alimento}</p>
              <p className="mt-0.5 text-[11px] text-stone-400">Estimación orientativa</p>
            </div>
            <span className="font-mono text-sm text-emerald-950">{estimacion.calorias} kcal</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MacroEstimado
              etiqueta="Proteína"
              valor={estimacion.proteina_g}
              color="text-teal-700"
            />
            <MacroEstimado etiqueta="Carbos" valor={estimacion.carbos_g} color="text-amber-700" />
            <MacroEstimado etiqueta="Grasa" valor={estimacion.grasa_g} color="text-violet-700" />
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-stone-500">
          La IA puede equivocarse. Confirma que la porción se parece a lo que comiste.
        </p>
        <ErrorFormulario error={guardar.error} />
        <Btn onClick={confirmar} disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 size={16} aria-hidden />
          )}
          Agregar a mi día
        </Btn>
      </div>
    );
  }

  return (
    <form onSubmit={solicitarEstimacion} className="space-y-4">
      <button type="button" onClick={onAtras} className="text-xs text-stone-500">
        ← Volver a opciones
      </button>
      <div>
        <label htmlFor="descripcion-comida" className="mb-1.5 block text-xs text-stone-500">
          Describe qué comiste y la cantidad
        </label>
        <textarea
          id="descripcion-comida"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          minLength={3}
          maxLength={500}
          required
          rows={4}
          placeholder="Ej. dos tacos de pollo con salsa verde"
          className={`${inputClass} resize-none`}
        />
      </div>
      <ErrorFormulario error={estimar.error} />
      <Btn type="submit" disabled={estimar.isPending || texto.trim().length < 3} className="w-full">
        {estimar.isPending ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Sparkles size={16} aria-hidden />
        )}
        {estimar.isPending ? 'Estimando…' : 'Estimar con IA'}
      </Btn>
    </form>
  );
}

function MacroEstimado({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2.5 text-center">
      <p className={`font-mono text-sm ${color}`}>{valor} g</p>
      <p className="mt-0.5 text-[10px] text-stone-400">{etiqueta}</p>
    </div>
  );
}
