'use client';

import { ClipboardList, FileText, Sparkles, Utensils } from 'lucide-react';

import type { Paciente } from '@nutria/shared';

import { GrabadorConsulta } from '@/components/pacientes/GrabadorConsulta';
import { NotasConsulta } from '@/components/pacientes/NotasConsulta';
import { SectionCard } from '@/components/ui/SectionCard';
import { WeightChart } from '@/components/ui/WeightChart';

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-400">{etiqueta}</span>
      <span className="text-emerald-950 font-medium text-right">{valor}</span>
    </div>
  );
}

export function TabExpediente({ paciente }: { paciente: Paciente }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <SectionCard title="Datos generales" icon={ClipboardList}>
        <div className="space-y-2 text-sm">
          <Fila etiqueta="Género" valor={paciente.genero} />
          <Fila etiqueta="Teléfono" valor={paciente.telefono || '—'} />
          <Fila etiqueta="Email" valor={paciente.email || '—'} />
        </div>
      </SectionCard>
      <SectionCard title="Expediente médico" icon={FileText}>
        <div className="space-y-2 text-sm">
          <Fila etiqueta="Condiciones" valor={paciente.medico.condiciones.join(', ')} />
          <Fila etiqueta="Medicamentos" valor={paciente.medico.medicamentos || '—'} />
          <Fila etiqueta="Nivel de actividad" valor={paciente.medico.nivelActividad} />
          {paciente.medico.antecedentes && (
            <div className="text-stone-500 text-xs pt-1 border-t border-stone-100">
              {paciente.medico.antecedentes}
            </div>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Antropometría" icon={Sparkles}>
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-stone-400">Peso</div>
            <div className="text-emerald-950 font-medium">{paciente.antropometria.peso} kg</div>
            <div className="text-stone-400">Altura</div>
            <div className="text-emerald-950 font-medium">{paciente.antropometria.altura} cm</div>
            <div className="text-stone-400">Cintura</div>
            <div className="text-emerald-950 font-medium">{paciente.antropometria.cintura || '—'} cm</div>
            <div className="text-stone-400">% grasa</div>
            <div className="text-emerald-950 font-medium">{paciente.antropometria.grasaCorporal || '—'}%</div>
          </div>
          <WeightChart data={paciente.antropometria.historial} />
        </div>
      </SectionCard>
      <SectionCard title="Preferencias alimentarias" icon={Utensils}>
        <div className="space-y-2 text-sm">
          <Fila etiqueta="Tipo de dieta" valor={paciente.preferencias.tipoDieta} />
          <Fila etiqueta="Alergias" valor={paciente.preferencias.alergias.join(', ')} />
          <Fila etiqueta="No le gusta" valor={paciente.preferencias.disgustos || '—'} />
          <Fila etiqueta="Comidas al día" valor={paciente.preferencias.comidasPorDia} />
        </div>
      </SectionCard>
      <div className="sm:col-span-2">
        <GrabadorConsulta paciente={paciente} />
      </div>
      <div className="sm:col-span-2">
        <NotasConsulta paciente={paciente} />
      </div>
    </div>
  );
}
