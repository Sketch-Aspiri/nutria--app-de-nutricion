'use client';

import { Loader2, Plus, Video } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FilaCita } from '@/components/agenda/FilaCita';
import { NuevaCitaModal } from '@/components/agenda/NuevaCitaModal';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { claveDeDia, diaLargoDeCita, horaDeCita } from '@/domain/agendaFormato';
import { useCancelarCita, useCitas, useCompletarCita } from '@/hooks/useAgenda';
import { usePacientes } from '@/hooks/usePacientes';
import type { CitaApi } from '@/services/agenda';

/** Agrupa por día natural conservando el orden cronológico que da la API. */
function agruparPorDia(citas: CitaApi[]): Array<{ dia: string; citas: CitaApi[] }> {
  const grupos = new Map<string, CitaApi[]>();
  for (const cita of citas) {
    const clave = claveDeDia(cita.inicio);
    grupos.set(clave, [...(grupos.get(clave) ?? []), cita]);
  }
  return [...grupos.entries()].map(([dia, citasDelDia]) => ({ dia, citas: citasDelDia }));
}

export default function AgendaPage() {
  const { citas, cargando, error } = useCitas();
  const { pacientes } = usePacientes();
  const [nueva, setNueva] = useState(false);
  const [videoCita, setVideoCita] = useState<CitaApi | null>(null);

  const cancelar = useCancelarCita();
  const completar = useCompletarCita();
  const ocupada = cancelar.isPending || completar.isPending;

  const dias = useMemo(() => agruparPorDia(citas), [citas]);
  const programadas = citas.filter((c) => c.estado === 'PROGRAMADA').length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Agenda</h1>
          <div className="text-stone-500 text-sm mt-1">
            {cargando ? 'Cargando…' : `${programadas} citas programadas`}
          </div>
        </div>
        <Btn onClick={() => setNueva(true)} disabled={pacientes.length === 0}>
          <Plus size={16} /> Nueva cita
        </Btn>
      </div>

      {error && (
        <div className="text-orange-600 text-sm mb-4">No pudimos cargar la agenda.</div>
      )}

      {cargando && (
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <Loader2 size={16} className="animate-spin" /> Cargando agenda…
        </div>
      )}

      {!cargando && citas.length === 0 && (
        <div className="text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl p-8 text-center">
          {pacientes.length === 0
            ? 'Da de alta a un paciente para poder agendar su primera consulta.'
            : 'Aún no tienes citas. Agenda la primera con el botón de arriba.'}
        </div>
      )}

      <div className="space-y-6">
        {dias.map(({ dia, citas: citasDelDia }) => (
          <section key={dia}>
            <h2 className="text-xs uppercase tracking-wide text-stone-400 mb-2">
              {diaLargoDeCita(citasDelDia[0]!.inicio)}
            </h2>
            <div className="space-y-3">
              {citasDelDia.map((cita) => (
                <FilaCita
                  key={cita.id}
                  cita={cita}
                  ocupada={ocupada}
                  onCancelar={(id) => cancelar.mutate(id)}
                  onCompletar={(id) => completar.mutate(id)}
                  onAbrirVideo={setVideoCita}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {(cancelar.error || completar.error) && (
        <div className="text-orange-600 text-xs mt-4">
          No pudimos actualizar la cita. Intenta de nuevo.
        </div>
      )}

      {nueva && (
        <NuevaCitaModal pacientes={pacientes} onClose={() => setNueva(false)} />
      )}

      {videoCita && (
        <Modal>
          <div className="p-6 text-center">
            <ModalHeader title="Videoconsulta" onClose={() => setVideoCita(null)} />
            <div className="bg-emerald-950 rounded-xl aspect-video flex flex-col items-center justify-center text-emerald-200 mb-4">
              <Video size={40} />
              <div className="text-sm mt-2">Consulta con {videoCita.paciente.nombre}</div>
              <div className="text-xs text-emerald-400 mt-1">
                {diaLargoDeCita(videoCita.inicio)} · {horaDeCita(videoCita.inicio)}
              </div>
            </div>
            {videoCita.video_url ? (
              <a
                href={videoCita.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-emerald-900 text-white rounded-full px-5 py-2.5 text-sm hover:bg-emerald-800"
              >
                Abrir sala de videollamada
              </a>
            ) : (
              <p className="text-xs text-stone-400">
                Esta cita no tiene enlace de sala. Edítala para agregar el de Zoom, Meet o
                Whereby y el paciente lo recibirá en su recordatorio.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
