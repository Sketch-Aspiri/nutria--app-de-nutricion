'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { aInstanteIso } from '@/domain/agendaFormato';
import { useCrearCita } from '@/hooks/useAgenda';
import { ApiError } from '@/services/http';
import type { PacienteResumenApi } from '@/services/pacientes';

type NuevaCitaModalProps = {
  pacientes: PacienteResumenApi[];
  onClose: () => void;
  onCreada?: () => void;
};

const DURACIONES = [30, 45, 60, 90];

export function NuevaCitaModal({ pacientes, onClose, onCreada }: NuevaCitaModalProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    pacienteId: pacientes[0]?.id ?? '',
    fecha: hoy,
    hora: '10:00',
    duracionMin: 45,
    tipo: 'PRESENCIAL' as 'PRESENCIAL' | 'VIDEOLLAMADA',
    videoUrl: '',
    notas: '',
  });
  const crear = useCrearCita();

  const enviar = () => {
    const inicio = aInstanteIso(form.fecha, form.hora);
    if (!inicio || !form.pacienteId) return;

    crear.mutate(
      {
        patient_id: form.pacienteId,
        inicio,
        duracion_min: form.duracionMin,
        tipo: form.tipo,
        notas: form.notas.trim() || null,
        video_url: form.tipo === 'VIDEOLLAMADA' && form.videoUrl.trim() ? form.videoUrl.trim() : null,
      },
      {
        onSuccess: () => {
          onCreada?.();
          onClose();
        },
      },
    );
  };

  const mensajeError =
    crear.error instanceof ApiError ? crear.error.message : crear.error ? 'No pudimos agendar la cita.' : null;

  return (
    <Modal>
      <div className="p-6">
        <ModalHeader title="Nueva cita" onClose={onClose} />
        <div className="space-y-3">
          <div>
            <label className={lbl} htmlFor="cita-paciente">
              Paciente
            </label>
            <select
              id="cita-paciente"
              className={inp}
              value={form.pacienteId}
              onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}
            >
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="cita-fecha">
                Fecha
              </label>
              <input
                id="cita-fecha"
                type="date"
                className={inp}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className={lbl} htmlFor="cita-hora">
                Hora
              </label>
              <input
                id="cita-hora"
                type="time"
                className={inp}
                value={form.hora}
                onChange={(e) => setForm({ ...form, hora: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} htmlFor="cita-duracion">
                Duración
              </label>
              <select
                id="cita-duracion"
                className={inp}
                value={form.duracionMin}
                onChange={(e) => setForm({ ...form, duracionMin: Number(e.target.value) })}
              >
                {DURACIONES.map((minutos) => (
                  <option key={minutos} value={minutos}>
                    {minutos} minutos
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl} htmlFor="cita-tipo">
                Tipo
              </label>
              <select
                id="cita-tipo"
                className={inp}
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as 'PRESENCIAL' | 'VIDEOLLAMADA' })
                }
              >
                <option value="PRESENCIAL">Presencial</option>
                <option value="VIDEOLLAMADA">Videollamada</option>
              </select>
            </div>
          </div>
          {form.tipo === 'VIDEOLLAMADA' && (
            <div>
              <label className={lbl} htmlFor="cita-video">
                Enlace de la sala
              </label>
              <input
                id="cita-video"
                type="url"
                placeholder="https://meet.google.com/..."
                className={inp}
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
              <p className="text-xs text-stone-400 mt-1">
                Se incluye en el recordatorio que recibe el paciente.
              </p>
            </div>
          )}
          <div>
            <label className={lbl} htmlFor="cita-notas">
              Notas (opcional)
            </label>
            <input
              id="cita-notas"
              className={inp}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Motivo de la consulta…"
            />
          </div>
          <p className="text-xs text-stone-400">
            El recordatorio por correo se envía automáticamente 24 horas antes.
          </p>
        </div>

        {mensajeError && <div className="text-orange-600 text-xs mt-3">{mensajeError}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={enviar} disabled={crear.isPending || !form.pacienteId}>
            {crear.isPending && <Loader2 size={14} className="animate-spin" />}
            Agendar
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
