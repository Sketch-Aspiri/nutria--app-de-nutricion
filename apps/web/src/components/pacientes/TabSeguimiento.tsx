'use client';

import { AlertTriangle, Dumbbell, Flame, Loader2, Share2, Sparkles, Utensils } from 'lucide-react';

import { esAdherenciaBaja, type Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useGenerarTexto } from '@/hooks/useIA';
import { useAppState } from '@/store/app-state';

export function TabSeguimiento({ paciente }: { paciente: Paciente }) {
  const { updatePatient } = useAppState();
  const generarRutina = useGenerarTexto();
  const s = paciente.seguimiento;
  const adherenciaBaja = esAdherenciaBaja(s.adherencia);

  const comentar = (id: number, texto: string) =>
    updatePatient(paciente.id, (p) => ({
      seguimiento: {
        ...p.seguimiento,
        comidas: p.seguimiento.comidas.map((c) => (c.id === id ? { ...c, comentario: texto } : c)),
      },
    }));

  const sugerirEjercicio = () => {
    const prompt = `Eres un asistente para nutriólogos. Sugiere en 4-5 líneas una rutina semanal de actividad física complementaria para: ${paciente.nombre}, objetivo ${paciente.medico.objetivo}, actividad ${paciente.medico.nivelActividad}, condiciones ${paciente.medico.condiciones.join(', ')}. Solo el texto, sin encabezados.`;
    generarRutina.mutate(
      { prompt, maxTokens: 400 },
      {
        onSuccess: (texto) =>
          updatePatient(paciente.id, { planEjercicio: { texto: texto.trim(), compartido: null } }),
      },
    );
  };

  const compartirEjercicio = () =>
    updatePatient(paciente.id, (p) =>
      p.planEjercicio
        ? { planEjercicio: { ...p.planEjercicio, compartido: new Date().toLocaleDateString('es-MX') } }
        : {},
    );

  return (
    <div className="space-y-4">
      <SectionCard title="Adherencia">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${adherenciaBaja ? 'bg-orange-400' : 'bg-lime-500'}`}
                style={{ width: `${s.adherencia}%` }}
              />
            </div>
            <div className="text-xs text-stone-500 mt-1">
              {s.adherencia}% de registros completados esta semana
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-emerald-800">
            <Flame size={16} /> {s.racha} días seguidos
          </div>
        </div>
        {adherenciaBaja && (
          <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-3">
            <AlertTriangle size={13} /> Adherencia baja — considera contactar al paciente o
            simplificar el plan.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Comidas registradas por el paciente" icon={Utensils}>
        {s.comidas.length === 0 && (
          <div className="text-sm text-stone-400">Aún no hay comidas registradas.</div>
        )}
        <div className="space-y-3">
          {s.comidas.map((c) => (
            <div key={c.id} className="flex items-start gap-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
              <div className="text-2xl">{c.emoji}</div>
              <div className="flex-1">
                <div className="text-sm text-emerald-950 font-medium">{c.nombre}</div>
                <div className="text-xs text-stone-400">{c.fecha}</div>
                <input
                  placeholder="Añadir comentario para el paciente..."
                  value={c.comentario}
                  onChange={(e) => comentar(c.id, e.target.value)}
                  className="text-xs mt-1 w-full border-b border-stone-200 focus:outline-none focus:border-emerald-400 pb-0.5 bg-transparent"
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Ejercicio registrado" icon={Dumbbell}>
        {s.ejercicio.length === 0 && (
          <div className="text-sm text-stone-400 mb-3">Aún no hay actividad registrada.</div>
        )}
        <div className="space-y-2 mb-3">
          {s.ejercicio.map((e) => (
            <div key={e.id} className="flex justify-between text-sm border-t border-stone-100 pt-2 first:border-0 first:pt-0">
              <span className="text-emerald-950">{e.tipo}</span>
              <span className="text-stone-400">
                {e.duracion} · {e.fecha}
              </span>
            </div>
          ))}
        </div>
        <Btn size="sm" onClick={sugerirEjercicio} disabled={generarRutina.isPending}>
          {generarRutina.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Sugerir plan de actividad con IA
        </Btn>
        {generarRutina.isError && (
          <div className="text-orange-600 text-xs mt-2">{generarRutina.error.message}</div>
        )}
        {paciente.planEjercicio && (
          <div className="mt-3 bg-lime-50 border border-lime-200 rounded-lg p-3 text-sm text-emerald-900">
            {paciente.planEjercicio.texto}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-emerald-700">
                {paciente.planEjercicio.compartido
                  ? `Compartido el ${paciente.planEjercicio.compartido}`
                  : 'Sin compartir'}
              </span>
              <button
                type="button"
                onClick={compartirEjercicio}
                className="flex items-center gap-1 text-xs text-emerald-900 underline"
              >
                <Share2 size={12} /> Compartir con paciente
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
