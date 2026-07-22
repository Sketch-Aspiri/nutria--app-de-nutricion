'use client';

import { Calculator, ChefHat, ChevronLeft, ClipboardList, Dumbbell, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { TabCalculo } from '@/components/pacientes/TabCalculo';
import { TabExpediente } from '@/components/pacientes/TabExpediente';
import { TabPlan } from '@/components/pacientes/TabPlan';
import { TabRecetas } from '@/components/pacientes/TabRecetas';
import { TabSeguimiento } from '@/components/pacientes/TabSeguimiento';
import { Avatar } from '@/components/ui/Avatar';
import { useAppState } from '@/store/app-state';

const TABS = [
  { id: 'expediente', label: 'Expediente', icon: ClipboardList },
  { id: 'calculo', label: 'Cálculo', icon: Calculator },
  { id: 'plan', label: 'Plan alimenticio', icon: Sparkles },
  { id: 'seguimiento', label: 'Seguimiento', icon: Dumbbell },
  { id: 'recetas', label: 'Recetas', icon: ChefHat },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function PacienteDetallePage() {
  const params = useParams<{ id: string }>();
  const { pacientes } = useAppState();
  const [tab, setTab] = useState<TabId>('expediente');

  const paciente = pacientes.find((p) => p.id === Number(params.id));

  if (!paciente) {
    return (
      <div className="p-8">
        <div className="text-stone-500 text-sm">Paciente no encontrado.</div>
        <Link href="/pacientes" className="text-emerald-800 text-sm underline mt-2 inline-block">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Link
        href="/pacientes"
        className="flex items-center gap-1 text-stone-500 text-sm mb-5 hover:text-emerald-900 w-fit"
      >
        <ChevronLeft size={16} /> Pacientes
      </Link>
      <div className="flex items-center gap-4 mb-6">
        <Avatar foto={paciente.foto} nombre={paciente.nombre} size={64} />
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">{paciente.nombre}</h1>
          <div className="text-stone-500 text-sm">
            {paciente.edad} años · {paciente.medico.objetivo}
          </div>
        </div>
      </div>
      <div className="flex gap-1 mb-5 border-b border-stone-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'expediente' && <TabExpediente paciente={paciente} />}
      {tab === 'calculo' && <TabCalculo paciente={paciente} />}
      {tab === 'plan' && <TabPlan paciente={paciente} />}
      {tab === 'seguimiento' && <TabSeguimiento paciente={paciente} />}
      {tab === 'recetas' && <TabRecetas paciente={paciente} />}
    </div>
  );
}
