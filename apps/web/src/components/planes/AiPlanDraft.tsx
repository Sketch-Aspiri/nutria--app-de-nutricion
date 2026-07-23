'use client';

import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import {
  NOMBRE_ECUACION,
  type Paciente,
  type PlanAlimenticio,
} from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useGenerarJSON } from '@/hooks/useIA';

type AiPlanDraftProps = {
  paciente: Paciente;
  onGenerated: (plan: PlanAlimenticio) => void;
};

function crearPrompt(paciente: Paciente, notas: string): string {
  const meta = paciente.calculo
    ? `Meta profesional (${NOMBRE_ECUACION[paciente.calculo.ecuacion]}): ${paciente.calculo.objetivoCalorias} kcal; ${paciente.calculo.proteina_g} g proteína; ${paciente.calculo.carbos_g} g carbohidratos; ${paciente.calculo.grasa_g} g grasa.`
    : 'No hay una meta calculada: propón cifras conservadoras y márcalas para revisión.';

  return `Actúa como asistente de un profesional de nutrición. Genera solo un BORRADOR de un día, nunca una indicación final. No inventes diagnósticos.
Paciente seudonimizado: ${paciente.edad} años, género ${paciente.genero}, ${paciente.antropometria.peso} kg, ${paciente.antropometria.altura} cm. Objetivo: ${paciente.medico.objetivo}. Condiciones: ${paciente.medico.condiciones.join(', ')}. Dieta: ${paciente.preferencias.tipoDieta}. Alergias: ${paciente.preferencias.alergias.join(', ')}. Evitar: ${paciente.preferencias.disgustos || 'sin datos'}. Número de comidas: ${paciente.preferencias.comidasPorDia}.
${meta}
Preferencias de esta propuesta: ${notas.trim() || 'ninguna adicional'}.
Responde SOLO JSON válido: {"calorias_diarias":number,"macros":{"proteina_g":number,"carbos_g":number,"grasa_g":number},"comidas":[{"nombre":string,"horario":string,"descripcion":string,"porcion":string,"calorias":number}],"nota_ia":string}`;
}

export function AiPlanDraft({ paciente, onGenerated }: AiPlanDraftProps) {
  const [notas, setNotas] = useState('');
  const generar = useGenerarJSON<PlanAlimenticio>();

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
            onClick={() =>
              generar.mutate(
                { prompt: crearPrompt(paciente, notas), maxTokens: 1600 },
                { onSuccess: onGenerated },
              )
            }
            disabled={generar.isPending}
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
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-stone-400">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Se envían datos clínicos seudonimizados, sin nombre ni contacto. Revisa alimentos,
        alergias y totales antes de guardar.
      </p>
      {generar.error && (
        <p role="alert" className="mt-2 text-xs text-orange-600">
          {generar.error instanceof SyntaxError
            ? 'La respuesta no tuvo el formato esperado. Intenta nuevamente.'
            : generar.error.message}
        </p>
      )}
    </SectionCard>
  );
}
