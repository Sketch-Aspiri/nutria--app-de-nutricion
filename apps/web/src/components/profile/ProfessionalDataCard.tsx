'use client';

import { BadgeCheck } from 'lucide-react';

import type { FormularioMarca } from '@/components/profile/model';
import { SectionCard } from '@/components/ui/SectionCard';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';

type ProfessionalDataCardProps = {
  form: FormularioMarca;
  onChange: (patch: Partial<FormularioMarca>) => void;
};

export function ProfessionalDataCard({ form, onChange }: ProfessionalDataCardProps) {
  return (
    <SectionCard title="Datos profesionales" icon={BadgeCheck}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl} htmlFor="nombre-profesional">
            Nombre profesional
          </label>
          <input
            id="nombre-profesional"
            className={inp}
            value={form.nombreCompleto}
            onChange={(event) => onChange({ nombreCompleto: event.target.value })}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="cedula">
            Cédula profesional
          </label>
          <input
            id="cedula"
            className={inp}
            value={form.cedula}
            onChange={(event) => onChange({ cedula: event.target.value })}
          />
        </div>
        <div>
          <label className={lbl} htmlFor="especialidad">
            Especialidad
          </label>
          <input
            id="especialidad"
            className={inp}
            value={form.especialidad}
            onChange={(event) => onChange({ especialidad: event.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl} htmlFor="telefono">
            Teléfono profesional
          </label>
          <input
            id="telefono"
            className={inp}
            value={form.telefono}
            onChange={(event) => onChange({ telefono: event.target.value })}
          />
        </div>
      </div>
    </SectionCard>
  );
}
