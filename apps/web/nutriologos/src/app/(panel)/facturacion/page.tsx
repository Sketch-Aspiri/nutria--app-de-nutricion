'use client';

import { Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { usePacientes } from '@/hooks/usePacientes';
import { useAppState } from '@/store/app-state';

export default function FacturacionPage() {
  const { facturas, setFacturas } = useAppState();
  const { pacientes } = usePacientes();
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState({
    pacienteId: pacientes[0]?.id ?? '',
    concepto: 'Consulta',
    monto: '600',
    cfdi: false,
  });

  const total = facturas.reduce((s, f) => s + (f.pagada ? f.monto : 0), 0);
  const pendiente = facturas.reduce((s, f) => s + (!f.pagada ? f.monto : 0), 0);

  const crear = () => {
    const p = pacientes.find((x) => x.id === form.pacienteId);
    if (!p) return;
    setFacturas((f) => [
      {
        id: Date.now(),
        pacienteId: p.id,
        paciente: p.nombre,
        concepto: form.concepto,
        monto: Number(form.monto) || 0,
        fecha: new Date().toISOString().slice(0, 10),
        pagada: false,
        cfdi: form.cfdi,
      },
      ...f,
    ]);
    setNueva(false);
  };

  const togglePago = (id: number) =>
    setFacturas((f) => f.map((x) => (x.id === id ? { ...x, pagada: !x.pagada } : x)));

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Facturación</h1>
          <div className="text-stone-500 text-sm mt-1">Cobros y comprobantes</div>
        </div>
        <Btn onClick={() => setNueva(true)}>
          <Plus size={16} /> Nuevo cobro
        </Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-400">Cobrado</div>
          <div className="font-mono text-2xl text-emerald-900">${total.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="text-xs text-stone-400">Pendiente</div>
          <div className="font-mono text-2xl text-orange-600">${pendiente.toLocaleString()}</div>
        </div>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
        {facturas.map((f) => (
          <div key={f.id} className="flex items-center gap-4 p-4">
            <div className="flex-1">
              <div className="text-sm text-emerald-950 font-medium">{f.paciente}</div>
              <div className="text-xs text-stone-400">
                {f.concepto} · {f.fecha} {f.cfdi && <span className="text-emerald-600">· CFDI</span>}
              </div>
            </div>
            <div className="font-mono text-sm text-emerald-950">${f.monto.toLocaleString()}</div>
            <button
              type="button"
              onClick={() => togglePago(f.id)}
              className={`flex items-center gap-1 text-xs rounded-full px-3 py-1 border ${
                f.pagada
                  ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                  : 'text-orange-600 border-orange-200 bg-orange-50'
              }`}
            >
              {f.pagada ? (
                <>
                  <Check size={12} /> Pagada
                </>
              ) : (
                'Marcar pagada'
              )}
            </button>
          </div>
        ))}
      </div>
      {nueva && (
        <Modal>
          <div className="p-6">
            <ModalHeader title="Nuevo cobro" onClose={() => setNueva(false)} />
            <div className="space-y-3">
              <div>
                <label className={lbl}>Paciente</label>
                <select
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
              <div>
                <label className={lbl}>Concepto</label>
                <input className={inp} value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Monto (MXN)</label>
                <input type="number" className={inp} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <input type="checkbox" checked={form.cfdi} onChange={(e) => setForm({ ...form, cfdi: e.target.checked })} />
                Generar factura CFDI 4.0
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn variant="ghost" onClick={() => setNueva(false)}>
                Cancelar
              </Btn>
              <Btn onClick={crear}>Crear cobro</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
