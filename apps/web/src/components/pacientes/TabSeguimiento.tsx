'use client';

import type { Paciente } from '@nutria/shared';

import { ComidasRegistradas } from '@/components/pacientes/seguimiento/ComidasRegistradas';
import { PanelAdherencia } from '@/components/pacientes/seguimiento/PanelAdherencia';
import { PlanActividad } from '@/components/pacientes/seguimiento/PlanActividad';
import { useSeguimiento } from '@/hooks/useSeguimiento';

/**
 * Seguimiento del paciente sobre datos reales.
 *
 * Adherencia y racha las calcula el servidor con `packages/shared/adherencia`
 * sobre `meal_logs` contra el plan activo; no son campos editables ni viven en
 * el almacén del navegador.
 */
export function TabSeguimiento({ paciente }: { paciente: Paciente }) {
  const { adherencia, comidas, ejercicio, error } = useSeguimiento(paciente.id);

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-orange-600 text-sm">No pudimos cargar el seguimiento.</div>
      )}
      <PanelAdherencia datos={adherencia} />
      <ComidasRegistradas pacienteId={paciente.id} comidas={comidas} />
      <PlanActividad pacienteId={paciente.id} ejercicio={ejercicio} />
    </div>
  );
}
