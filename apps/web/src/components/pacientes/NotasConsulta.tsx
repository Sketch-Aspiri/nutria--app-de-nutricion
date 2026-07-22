'use client';

import { Loader2, MessageSquarePlus, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useNotaClinica } from '@/hooks/useNotaClinica';

export function NotasConsulta({ paciente }: { paciente: Paciente }) {
  const [nota, setNota] = useState('');
  const { procesar, procesando } = useNotaClinica(paciente);

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
      {paciente.notasConsulta.length > 0 && (
        <div className="mt-4 space-y-3">
          {paciente.notasConsulta.map((n, i) => (
            <div key={i} className="border-t border-stone-100 pt-3 text-sm">
              <div className="text-xs text-stone-400 mb-1">{n.fecha}</div>
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
