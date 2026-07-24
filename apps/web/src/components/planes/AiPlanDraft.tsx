'use client';

import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useCuotaIA, useGenerarIAConStream } from '@/hooks/useIA';
import { ErrorIA, type PlanBorradorIa } from '@/services/ia';

type AiPlanDraftProps = {
  paciente: Paciente;
  onGenerated: (borrador: PlanBorradorIa) => void;
};

/**
 * Borrador de plan asistido por IA.
 *
 * El componente no arma prompts: manda `tipo: 'PLAN'` y el identificador del
 * paciente, y el servidor construye el contexto ya seudonimizado. Lo que vuelve
 * está validado contra las alergias y la meta energética del expediente.
 */
export function AiPlanDraft({ paciente, onGenerated }: AiPlanDraftProps) {
  const [notas, setNotas] = useState('');
  const cuota = useCuotaIA();
  const generar = useGenerarIAConStream<PlanBorradorIa>();
  const { estado } = generar;

  const sinCuota = cuota.data?.agotada ?? false;
  const error = generar.error instanceof ErrorIA ? generar.error : null;

  const solicitar = () =>
    generar.mutate(
      { tipo: 'PLAN', patient_id: paciente.id, notas: notas.trim() || undefined },
      {
        onSuccess: (salida) => {
          if (salida.formato === 'estructurado' && salida.datos) onGenerated(salida.datos);
        },
      },
    );

  return (
    <SectionCard title="Borrador asistido" icon={Sparkles}>
      <div className="grid items-end gap-3 md:grid-cols-[1fr_auto]">
        <label className="text-xs uppercase tracking-wide text-stone-400">
          Enfoque de esta propuesta
          <textarea
            value={notas}
            onChange={(evento) => setNotas(evento.target.value)}
            placeholder="Ej. desayunos rápidos, mayor fibra, cocina mexicana, cuatro tiempos…"
            rows={2}
            className="mt-1.5 w-full resize-none rounded-lg border border-stone-200 bg-white p-3 text-sm normal-case leading-5 tracking-normal text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <span data-testid="generate-ai-plan">
          <Btn
            onClick={solicitar}
            disabled={generar.isPending || sinCuota}
            className="w-full justify-center md:mb-0.5 md:w-auto"
          >
            {generar.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} />
            )}
            {generar.isPending ? 'Preparando…' : 'Generar borrador'}
          </Btn>
        </span>
      </div>

      {generar.isPending && (
        <p className="mt-2 text-xs text-stone-500" role="status">
          {estado.reintento
            ? 'Ajustando el borrador para que cumpla las restricciones del expediente…'
            : `Redactando el borrador… ${estado.avance} caracteres`}
        </p>
      )}

      {/* `limite === null` es la beta comercial: no hay cuenta regresiva que dar. */}
      {cuota.data && !cuota.data.agotada && cuota.data.limite !== null && (
        <p className="mt-2 text-[11px] text-stone-400">
          Te quedan {cuota.data.restantes} de {cuota.data.limite} generaciones de IA este mes.
        </p>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-stone-400">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Se envían datos clínicos seudonimizados, sin nombre ni contacto. Revisa alimentos,
        alergias y totales antes de guardar.
      </p>

      {(sinCuota || error?.esLimiteAlcanzado) && (
        <p role="alert" className="mt-2 text-xs text-orange-600">
          Agotaste tus generaciones de IA de este mes.{' '}
          <a href="/suscripcion" className="underline">
            Mejora tu plan
          </a>{' '}
          para seguir generando borradores.
        </p>
      )}

      {error && !error.esLimiteAlcanzado && (
        <p role="alert" className="mt-2 text-xs text-orange-600">
          {error.message}
        </p>
      )}

      {generar.data?.formato === 'texto' && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-xs text-orange-700">
            El borrador no pasó la validación clínica
            {generar.data.advertencias.length > 0
              ? `: ${generar.data.advertencias.join(' ')}`
              : '.'}{' '}
            Abajo queda la propuesta en crudo para que la uses como referencia.
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[11px] text-stone-600">
            {generar.data.texto}
          </pre>
        </div>
      )}
    </SectionCard>
  );
}
