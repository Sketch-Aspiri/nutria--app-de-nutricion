'use client';

import { Copy } from 'lucide-react';

import type { PlanEditable } from '@/components/planes/editor-model';
import { Btn } from '@/components/ui/Btn';

type PlanEditorHeaderProps = {
  plan: PlanEditable;
  modificado: boolean;
  guardando: boolean;
  onDuplicate: () => void;
};

const ESTADO: Record<PlanEditable['estado'], { texto: string; clase: string }> = {
  BORRADOR: {
    texto: 'Borrador',
    clase: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  ACTIVO: {
    texto: 'Activo',
    clase: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  ARCHIVADO: {
    texto: 'Archivado',
    clase: 'border-stone-200 bg-stone-100 text-stone-500',
  },
};

const STATUS_BADGE_CLASS = [
  'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase',
  'tracking-wider',
].join(' ');

const HISTORICAL_NOTICE_CLASS = [
  'flex flex-wrap items-center justify-between gap-3 rounded-lg border',
  'border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600',
].join(' ');

const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
});

function mensajeCambios(plan: PlanEditable, modificado: boolean): string {
  if (modificado) return 'Cambios sin guardar';
  return plan.id ? 'Todos los cambios guardados' : 'Nuevo plan';
}

export function PlanEditorHeader({
  plan,
  modificado,
  guardando,
  onDuplicate,
}: PlanEditorHeaderProps) {
  const esHistorico = plan.estado !== 'BORRADOR';
  const fechaCompartida = plan.compartido_at
    ? DATE_FORMATTER.format(new Date(plan.compartido_at))
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`${STATUS_BADGE_CLASS} ${ESTADO[plan.estado].clase}`}
          >
            {ESTADO[plan.estado].texto}
          </span>
          <span className="text-xs text-stone-400">
            {mensajeCambios(plan, modificado)}
          </span>
        </div>
        {fechaCompartida && (
          <span className="text-xs text-stone-400">
            Compartido {fechaCompartida}
          </span>
        )}
      </div>

      {esHistorico && (
        <div className={HISTORICAL_NOTICE_CLASS}>
          <p>
            Este plan conserva el historial entregado al paciente y es de solo
            lectura.
          </p>
          <Btn variant="outline" onClick={onDuplicate} disabled={guardando}>
            <Copy size={14} /> Duplicar para editar
          </Btn>
        </div>
      )}
    </>
  );
}
