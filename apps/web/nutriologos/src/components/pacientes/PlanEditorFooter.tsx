'use client';

import {
  CheckCircle2,
  Download,
  LayoutTemplate,
  Loader2,
  RotateCcw,
  Save,
  Send,
} from 'lucide-react';

import type { PlanEditable } from '@/components/planes/editor-model';
import { Btn } from '@/components/ui/Btn';

type PlanEditorFooterProps = {
  plan: PlanEditable;
  modificado: boolean;
  guardando: boolean;
  error: string | null;
  hayConflictoAlergia: boolean;
  tieneItems: boolean;
  energiaEnRango: boolean;
  listoParaActivar: boolean;
  energiaTotal: number;
  onSave: () => void;
  onActivate: () => void;
  onShare: () => void;
  onExport: () => void;
  onSaveTemplate: () => void;
  onReset: () => void;
};

const ERROR_CLASS = [
  'rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs',
  'text-orange-700',
].join(' ');

const ALLERGY_WARNING_CLASS = [
  'flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50',
  'px-3 py-2 text-xs leading-5 text-orange-700',
].join(' ');

const ENERGY_WARNING_CLASS = [
  'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs',
  'leading-5 text-amber-800',
].join(' ');

const ACTION_BAR_CLASS = [
  'flex flex-wrap items-center gap-2 rounded-xl border border-stone-200',
  'bg-white p-3',
].join(' ');

const RESET_BUTTON_CLASS = [
  'ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs',
  'text-stone-400 hover:bg-stone-100 hover:text-stone-600',
].join(' ');

export function PlanEditorFooter({
  plan,
  modificado,
  guardando,
  error,
  hayConflictoAlergia,
  tieneItems,
  energiaEnRango,
  listoParaActivar,
  energiaTotal,
  onSave,
  onActivate,
  onShare,
  onExport,
  onSaveTemplate,
  onReset,
}: PlanEditorFooterProps) {
  const esHistorico = plan.estado !== 'BORRADOR';

  return (
    <>
      {error && (
        <p role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      )}

      {hayConflictoAlergia && (
        <p role="alert" className={ALLERGY_WARNING_CLASS}>
          Revisa los alimentos marcados: el plan coincide con una alergia
          registrada. No se puede activar ni compartir hasta resolver el
          conflicto.
        </p>
      )}

      {tieneItems && plan.calorias_diarias > 0 && !energiaEnRango && (
        <p role="alert" className={ENERGY_WARNING_CLASS}>
          Ajusta la energía del plan a ±5% de la meta para poder activarlo o
          compartirlo. Total actual: {Math.round(energiaTotal)} kcal.
        </p>
      )}

      <div className={ACTION_BAR_CLASS}>
        <span data-testid="save-plan">
          <Btn
            onClick={onSave}
            disabled={guardando || esHistorico || plan.calorias_diarias <= 0}
          >
            {guardando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Guardar borrador
          </Btn>
        </span>
        <span data-testid="activate-plan">
          <Btn
            variant="outline"
            onClick={onActivate}
            disabled={
              guardando ||
              !listoParaActivar ||
              plan.estado === 'ACTIVO'
            }
          >
            <CheckCircle2 size={14} /> Activar plan
          </Btn>
        </span>
        <span data-testid="share-plan">
          <Btn
            variant="outline"
            onClick={onShare}
            disabled={
              guardando ||
              plan.estado !== 'ACTIVO' ||
              modificado ||
              hayConflictoAlergia ||
              !energiaEnRango
            }
          >
            <Send size={14} />{' '}
            {plan.compartido_at ? 'Volver a compartir' : 'Compartir'}
          </Btn>
        </span>
        <span data-testid="export-plan-pdf">
          <Btn
            variant="ghost"
            onClick={onExport}
            disabled={!plan.id || guardando || modificado}
          >
            <Download size={14} /> PDF
          </Btn>
        </span>
        <Btn
          variant="ghost"
          onClick={onSaveTemplate}
          disabled={!tieneItems || guardando}
        >
          <LayoutTemplate size={14} /> Guardar plantilla
        </Btn>
        {modificado && (
          <button
            type="button"
            onClick={onReset}
            className={RESET_BUTTON_CLASS}
          >
            <RotateCcw size={13} /> Restablecer
          </button>
        )}
      </div>
    </>
  );
}
