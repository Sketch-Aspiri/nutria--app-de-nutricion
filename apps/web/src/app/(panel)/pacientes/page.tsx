'use client';

import { AlertTriangle, Flame, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { esAdherenciaBaja, type Paciente, type Seguimiento } from '@nutria/shared';

import { NuevoPacienteWizard } from '@/components/pacientes/NuevoPacienteWizard';
import { Avatar } from '@/components/ui/Avatar';
import { Btn } from '@/components/ui/Btn';
import { useAppState } from '@/store/app-state';

function AdherenciaBadge({ s }: { s: Seguimiento }) {
  const bajo = esAdherenciaBaja(s.adherencia);
  return (
    <div className={`flex items-center gap-1 text-[11px] ${bajo ? 'text-orange-600' : 'text-emerald-700'}`}>
      {bajo ? <AlertTriangle size={12} /> : <Flame size={12} />}
      {s.adherencia}% adherencia {s.racha > 0 ? `· racha ${s.racha}d` : ''}
    </div>
  );
}

export default function PacientesPage() {
  const { pacientes, crearPaciente } = useAppState();
  const [showWizard, setShowWizard] = useState(false);
  const router = useRouter();

  const onCrear = (nuevo: Paciente) => {
    crearPaciente(nuevo);
    setShowWizard(false);
    router.push(`/pacientes/${nuevo.id}`);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Tus pacientes</h1>
          <div className="text-stone-500 text-sm mt-1">{pacientes.length} pacientes activos</div>
        </div>
        <Btn onClick={() => setShowWizard(true)}>
          <Plus size={16} /> Nuevo paciente
        </Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pacientes.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => router.push(`/pacientes/${p.id}`)}
            className="text-left bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <Avatar foto={p.foto} nombre={p.nombre} />
            <div className="min-w-0 flex-1">
              <div className="text-emerald-950 font-medium truncate">{p.nombre}</div>
              <div className="text-stone-500 text-xs mt-0.5">{p.medico.objetivo}</div>
              <AdherenciaBadge s={p.seguimiento} />
            </div>
          </button>
        ))}
      </div>
      {showWizard && <NuevoPacienteWizard onClose={() => setShowWizard(false)} onCrear={onCrear} />}
    </div>
  );
}
