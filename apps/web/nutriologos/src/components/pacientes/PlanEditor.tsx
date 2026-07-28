'use client';

import { tieneConflictoAlergia, type Paciente } from '@nutria/shared';

import {
  calcularTotalesPlan,
  itemTieneContenido,
  type PlanEditable,
} from '@/components/planes/editor-model';
import {
  PlanEditorContent,
  textoComida,
} from '@/components/pacientes/PlanEditorContent';
import { PlanEditorFooter } from '@/components/pacientes/PlanEditorFooter';
import { PlanEditorHeader } from '@/components/pacientes/PlanEditorHeader';

type PlanEditorProps = {
  paciente: Paciente;
  plan: PlanEditable;
  modificado: boolean;
  guardando: boolean;
  error: string | null;
  onChange: (actualizar: (plan: PlanEditable) => PlanEditable) => void;
  onAddFood: (comidaClave: string) => void;
  onSave: () => void;
  onActivate: () => void;
  onShare: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onSaveTemplate: () => void;
  onReset: () => void;
};

export function PlanEditor({
  paciente,
  plan,
  modificado,
  guardando,
  error,
  onChange,
  onAddFood,
  onSave,
  onActivate,
  onShare,
  onDuplicate,
  onExport,
  onSaveTemplate,
  onReset,
}: PlanEditorProps) {
  const totales = calcularTotalesPlan(plan);
  const tieneItems = plan.comidas.some((comida) =>
    comida.items.some(itemTieneContenido),
  );
  const hayConflictoAlergia = plan.comidas.some((comida) =>
    tieneConflictoAlergia(textoComida(comida), paciente.preferencias.alergias),
  );
  const desviacionEnergetica =
    plan.calorias_diarias > 0
      ? Math.abs(totales.energia_kcal - plan.calorias_diarias) /
        plan.calorias_diarias
      : Number.POSITIVE_INFINITY;
  const energiaEnRango = desviacionEnergetica <= 0.05;
  const listoParaActivar = Boolean(
    plan.id &&
      tieneItems &&
      plan.calorias_diarias > 0 &&
      energiaEnRango &&
      !hayConflictoAlergia,
  );

  return (
    <div className="space-y-4">
      <PlanEditorHeader
        plan={plan}
        modificado={modificado}
        guardando={guardando}
        onDuplicate={onDuplicate}
      />

      <PlanEditorContent
        plan={plan}
        totales={totales}
        alergias={paciente.preferencias.alergias}
        onChange={onChange}
        onAddFood={onAddFood}
      />

      <PlanEditorFooter
        plan={plan}
        modificado={modificado}
        guardando={guardando}
        error={error}
        hayConflictoAlergia={hayConflictoAlergia}
        tieneItems={tieneItems}
        energiaEnRango={energiaEnRango}
        listoParaActivar={listoParaActivar}
        energiaTotal={totales.energia_kcal}
        onSave={onSave}
        onActivate={onActivate}
        onShare={onShare}
        onExport={onExport}
        onSaveTemplate={onSaveTemplate}
        onReset={onReset}
      />
    </div>
  );
}
