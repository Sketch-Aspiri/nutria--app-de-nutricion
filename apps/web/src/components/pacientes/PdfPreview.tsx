'use client';

import { Download, X } from 'lucide-react';

import type { Marca, Paciente, PlanAlimenticio } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { Modal } from '@/components/ui/Modal';

type PdfPreviewProps = {
  paciente: Paciente;
  plan: PlanAlimenticio;
  marca: Marca;
  onClose: () => void;
};

export function PdfPreview({ paciente, plan, marca, onClose }: PdfPreviewProps) {
  return (
    <Modal wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-lg text-emerald-950 font-medium">
            Vista previa · plan con tu marca
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={() => window.print()}>
              <Download size={14} /> Descargar / Imprimir
            </Btn>
            <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-8" id="pdf-area">
          <div
            className="flex items-center justify-between border-b-2 pb-4 mb-5"
            style={{ borderColor: marca.color }}
          >
            <div className="flex items-center gap-3">
              {marca.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo subido como data URL
                <img src={marca.logo} alt="logo" className="w-12 h-12 object-contain rounded" />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ background: marca.color }}
                >
                  {(marca.nombre || 'N')[0]}
                </div>
              )}
              <div>
                <div className="font-display text-xl">{marca.nombre || 'nutria'}</div>
                <div className="text-xs text-stone-400">{marca.profesional || 'Nutrióloga certificada'}</div>
              </div>
            </div>
            <div className="text-right text-xs text-stone-400">
              <div>Plan alimenticio</div>
              <div>{new Date().toLocaleDateString('es-MX')}</div>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-sm text-stone-400">Paciente</div>
            <div className="text-lg text-emerald-950 font-medium">{paciente.nombre}</div>
            <div className="text-xs text-stone-400">
              {paciente.medico.objetivo} · {plan.calorias_diarias} kcal/día
            </div>
          </div>
          <div className="space-y-3">
            {plan.comidas.map((c, i) => (
              <div key={i} className="border-l-2 pl-3" style={{ borderColor: marca.color }}>
                <div className="text-sm font-medium text-emerald-950">
                  {c.nombre} <span className="text-stone-400 font-normal">· {c.horario}</span>
                </div>
                <div className="text-xs text-stone-500">{c.descripcion}</div>
                <div className="font-mono text-xs text-stone-400 mt-0.5">
                  {c.porcion ? c.porcion + ' · ' : ''}
                  {c.calorias} kcal
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-stone-400 mt-6 pt-3 border-t border-stone-100">
            Documento generado por {marca.nombre || 'nutria'}. Uso exclusivo del paciente. No
            sustituye consulta médica.
          </div>
        </div>
      </div>
    </Modal>
  );
}
