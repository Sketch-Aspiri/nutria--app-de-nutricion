'use client';

import {
  CheckCircle2,
  Loader2,
  LockKeyhole,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

import type { Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useNotaClinica } from '@/hooks/useNotaClinica';

export function NotasConsulta({ paciente }: { paciente: Paciente }) {
  const [nota, setNota] = useState('');
  const { procesar, procesando, notas, cargando, firmar, firmando } =
    useNotaClinica(paciente);

  const generar = async () => {
    await procesar(nota);
    setNota('');
  };

  return (
    <SectionCard title="Notas de consulta" icon={MessageSquarePlus}>
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Escribe notas rápidas y la IA las convierte en resumen clínico estructurado..."
        className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400"
        rows={2}
      />
      <Btn onClick={generar} disabled={procesando || !nota.trim()} size="sm" className="mt-2">
        {procesando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        Generar resumen con IA
      </Btn>
      {cargando && (
        <div className="mt-4 flex items-center gap-2 text-xs text-stone-400">
          <Loader2 size={13} className="animate-spin" /> Cargando notas…
        </div>
      )}
      {notas.length > 0 && (
        <div className="mt-4 space-y-3">
          {notas.map((n) => (
            <div key={n.id} className="border-t border-stone-100 pt-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs text-stone-400">
                <span>{new Date(n.fecha).toLocaleString('es-MX')}</span>
                {n.firmada_at ? (
                  <span className="flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={12} /> Firmada
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={firmando}
                    onClick={() => void firmar(n.id)}
                    className="flex items-center gap-1 font-medium text-emerald-800 hover:underline disabled:opacity-50"
                  >
                    <LockKeyhole size={12} /> Firmar nota
                  </button>
                )}
              </div>
              <div>
                <span className="text-stone-500">Motivo: </span>
                {n.motivo}
              </div>
              <div>
                <span className="text-stone-500">Hallazgos: </span>
                {n.hallazgos}
              </div>
              <div>
                <span className="text-stone-500">Plan: </span>
                {n.plan}
              </div>
              <div>
                <span className="text-stone-500">Seguimiento: </span>
                {n.seguimiento}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
