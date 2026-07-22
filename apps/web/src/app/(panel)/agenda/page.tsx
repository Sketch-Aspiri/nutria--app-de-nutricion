'use client';

import { Bell, Plus, Video } from 'lucide-react';
import { useState } from 'react';

import type { Cita } from '@nutria/shared';

import { NuevaCitaModal } from '@/components/agenda/NuevaCitaModal';
import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { useAppState } from '@/store/app-state';

export default function AgendaPage() {
  const { citas, setCitas, pacientes } = useAppState();
  const [nueva, setNueva] = useState(false);
  const [videoCita, setVideoCita] = useState<Cita | null>(null);

  const toggleRecordatorio = (id: number) =>
    setCitas((c) => c.map((x) => (x.id === id ? { ...x, recordatorio: !x.recordatorio } : x)));
  const ordenadas = [...citas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Agenda</h1>
          <div className="text-stone-500 text-sm mt-1">{citas.length} citas programadas</div>
        </div>
        <Btn onClick={() => setNueva(true)}>
          <Plus size={16} /> Nueva cita
        </Btn>
      </div>
      <div className="space-y-3">
        {ordenadas.map((c) => (
          <div key={c.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4">
            <div className="text-center shrink-0 w-14">
              <div className="font-mono text-emerald-900 text-lg">{c.hora}</div>
              <div className="text-[10px] text-stone-400">{c.fecha.slice(5)}</div>
            </div>
            <div className="flex-1">
              <div className="text-sm text-emerald-950 font-medium">{c.paciente}</div>
              <div className="text-xs text-stone-400">{c.tipo}</div>
            </div>
            <button
              type="button"
              onClick={() => toggleRecordatorio(c.id)}
              className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
                c.recordatorio
                  ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                  : 'text-stone-400 border-stone-200'
              }`}
            >
              <Bell size={12} /> {c.recordatorio ? 'Recordatorio activo' : 'Sin recordatorio'}
            </button>
            <Btn size="sm" variant="outline" onClick={() => setVideoCita(c)}>
              <Video size={14} /> Videollamada
            </Btn>
          </div>
        ))}
      </div>

      {nueva && (
        <NuevaCitaModal
          pacientes={pacientes}
          onClose={() => setNueva(false)}
          onCrear={(cita) => {
            setCitas((c) => [...c, cita]);
            setNueva(false);
          }}
        />
      )}

      {videoCita && (
        <Modal>
          <div className="p-6 text-center">
            <ModalHeader title="Sala de videoconsulta" onClose={() => setVideoCita(null)} />
            <div className="bg-emerald-950 rounded-xl aspect-video flex flex-col items-center justify-center text-emerald-200 mb-4">
              <Video size={40} />
              <div className="text-sm mt-2">Videollamada con {videoCita.paciente}</div>
              <div className="text-xs text-emerald-400 mt-1">
                {videoCita.fecha} · {videoCita.hora}
              </div>
            </div>
            <p className="text-xs text-stone-400">
              En producción esto abriría una sala segura de video (WebRTC / integración con Zoom o
              Whereby) con enlace enviado al paciente.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
