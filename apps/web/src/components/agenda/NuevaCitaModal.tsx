'use client';

import { useState } from 'react';

import type { Cita, Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';

type NuevaCitaModalProps = {
  pacientes: Paciente[];
  onClose: () => void;
  onCrear: (cita: Cita) => void;
};

export function NuevaCitaModal({ pacientes, onClose, onCrear }: NuevaCitaModalProps) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    pacienteId: pacientes[0]?.id ?? 0,
    fecha: hoy,
    hora: '10:00',
    tipo: 'Seguimiento',
    recordatorio: true,
  });

  const crear = () => {
    const p = pacientes.find((x) => x.id === Number(form.pacienteId));
    if (!p) return;
    onCrear({
      id: Date.now(),
      pacienteId: p.id,
      paciente: p.nombre,
      fecha: form.fecha,
      hora: form.hora,
      tipo: form.tipo,
      recordatorio: form.recordatorio,
    });
  };

  return (
    <Modal>
      <div className="p-6">
        <ModalHeader title="Nueva cita" onClose={onClose} />
        <div className="space-y-3">
          <div>
            <label className={lbl}>Paciente</label>
            <select
              className={inp}
              value={form.pacienteId}
              onChange={(e) => setForm({ ...form, pacienteId: Number(e.target.value) })}
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
              <label className={lbl}>Fecha</label>
              <input
                type="date"
                className={inp}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className={lbl}>Hora</label>
              <input
                type="time"
                className={inp}
                value={form.hora}
                onChange={(e) => setForm({ ...form, hora: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select className={inp} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option>Primera consulta</option>
              <option>Seguimiento</option>
              <option>Videoconsulta</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={form.recordatorio}
              onChange={(e) => setForm({ ...form, recordatorio: e.target.checked })}
            />
            Enviar recordatorio automático al paciente
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn onClick={crear}>Agendar</Btn>
        </div>
      </div>
    </Modal>
  );
}
