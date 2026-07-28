'use client';

import { Dumbbell, Loader2, Share2, Sparkles } from 'lucide-react';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useGenerarIA } from '@/hooks/useIA';
import {
  useCompartirPlanActividad,
  useGuardarPlanActividad,
  usePlanActividad,
} from '@/hooks/useSeguimiento';
import type { EjercicioRegistradoApi } from '@/services/seguimiento';

const FECHA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const FECHA_HORA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

type Props = {
  pacienteId: string;
  ejercicio: EjercicioRegistradoApi[];
};

export function PlanActividad({ pacienteId, ejercicio }: Props) {
  const { plan } = usePlanActividad(pacienteId);
  const generar = useGenerarIA();
  const guardar = useGuardarPlanActividad(pacienteId);
  const compartir = useCompartirPlanActividad(pacienteId);

  /**
   * La IA propone y el nutriólogo aprueba: lo generado se guarda como
   * borrador (`origen: IA`, sin `compartido_at`) y no llega al paciente hasta
   * que se comparte explícitamente.
   */
  const sugerir = () => {
    generar.mutate(
      { tipo: 'PLAN_ACTIVIDAD', patient_id: pacienteId },
      {
        onSuccess: (salida) => {
          if (!salida.texto) return;
          guardar.mutate({ texto: salida.texto, origen: 'IA' });
        },
      },
    );
  };

  const ocupado = generar.isPending || guardar.isPending;

  return (
    <SectionCard title="Actividad física" icon={Dumbbell}>
      {ejercicio.length === 0 && (
        <div className="text-sm text-stone-400 mb-3">Aún no hay actividad registrada.</div>
      )}
      <div className="space-y-2 mb-3">
        {ejercicio.map((registro) => (
          <div
            key={registro.id}
            className="flex justify-between text-sm border-t border-stone-100 pt-2 first:border-0 first:pt-0"
          >
            <span className="text-emerald-950">{registro.tipo}</span>
            <span className="text-stone-400">
              {registro.duracion_min} min · {FECHA.format(new Date(`${registro.fecha}T12:00:00`))}
            </span>
          </div>
        ))}
      </div>

      <Btn size="sm" onClick={sugerir} disabled={ocupado}>
        {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Sugerir plan de actividad con IA
      </Btn>

      {generar.isError && (
        <div className="text-orange-600 text-xs mt-2">{generar.error.message}</div>
      )}
      {guardar.isError && (
        <div className="text-orange-600 text-xs mt-2">No pudimos guardar el plan.</div>
      )}

      {plan && (
        <div
          className="mt-3 bg-lime-50 border border-lime-200 rounded-lg p-3 text-sm text-emerald-900 whitespace-pre-wrap"
          data-testid="plan-actividad"
        >
          {plan.texto}
          <div className="flex items-center justify-between mt-2 gap-3">
            <span className="text-xs text-emerald-700">
              {plan.compartido_at
                ? `Compartido el ${FECHA_HORA.format(new Date(plan.compartido_at))}`
                : plan.origen === 'IA'
                  ? 'Borrador de IA — revísalo antes de compartirlo'
                  : 'Sin compartir'}
            </span>
            {!plan.compartido_at && (
              <button
                type="button"
                onClick={() => compartir.mutate(plan.id)}
                disabled={compartir.isPending}
                className="flex items-center gap-1 text-xs text-emerald-900 underline disabled:opacity-50 shrink-0"
              >
                {compartir.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Share2 size={12} />
                )}
                Compartir con paciente
              </button>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
