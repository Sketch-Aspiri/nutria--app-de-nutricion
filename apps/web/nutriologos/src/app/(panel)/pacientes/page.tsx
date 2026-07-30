'use client';

import { Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { etiquetaObjetivo, objetivoDesdeDb } from '@nutria/shared';

import { ConfirmarBajaPaciente } from '@/components/pacientes/ConfirmarBajaPaciente';
import { NuevoPacienteWizard } from '@/components/pacientes/NuevoPacienteWizard';
import { Avatar } from '@/components/ui/Avatar';
import { Btn } from '@/components/ui/Btn';
import { usePacientes } from '@/hooks/usePacientes';

function EstadoVacio({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-xl p-10 text-center">
      <Users className="mx-auto text-stone-300" size={32} />
      <div className="text-emerald-950 font-medium mt-3">Todavía no tienes pacientes</div>
      <p className="text-stone-500 text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">
        Da de alta al primero para registrar su expediente, calcular su requerimiento y armarle
        un plan.
      </p>
      <Btn onClick={onNuevo} className="mt-5">
        <Plus size={16} /> Nuevo paciente
      </Btn>
    </div>
  );
}

export default function PacientesPage() {
  const { pacientes, cargando, error } = usePacientes();
  const [showWizard, setShowWizard] = useState(false);
  const [aBorrar, setABorrar] = useState<{ id: string; nombre: string } | null>(null);
  const router = useRouter();

  const alCrear = (id: string) => {
    setShowWizard(false);
    router.push(`/pacientes/${id}`);
  };

  return (
    <div className="max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-emerald-950 font-medium">Tus pacientes</h1>
          <div className="text-stone-500 text-sm mt-1">
            {cargando ? 'Cargando…' : `${pacientes.length} pacientes activos`}
          </div>
        </div>
        {pacientes.length > 0 && (
          <Btn onClick={() => setShowWizard(true)}>
            <Plus size={16} /> Nuevo paciente
          </Btn>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg px-4 py-3 mb-4"
        >
          No pudimos cargar tus pacientes. Revisa tu conexión y recarga la página.
        </div>
      )}

      {!cargando && !error && pacientes.length === 0 && (
        <EstadoVacio onNuevo={() => setShowWizard(true)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pacientes.map((p) => (
          // La tarjeta no puede ser un <button>: anidaría el de eliminar dentro.
          <div
            key={p.id}
            className="relative bg-white border border-stone-200 rounded-xl flex items-center hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <button
              type="button"
              onClick={() => router.push(`/pacientes/${p.id}`)}
              className="text-left p-4 pr-12 flex items-center gap-4 flex-1 min-w-0"
            >
              <Avatar foto={p.foto_url} nombre={p.nombre} />
              <div className="min-w-0 flex-1">
                <div className="text-emerald-950 font-medium truncate">{p.nombre}</div>
                <div className="text-stone-500 text-xs mt-0.5">
                  {p.objetivo
                    ? etiquetaObjetivo(objetivoDesdeDb(p.objetivo), p.objetivo_otro)
                    : 'Sin objetivo definido'}
                  {p.edad > 0 && ` · ${p.edad} años`}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setABorrar({ id: p.id, nombre: p.nombre })}
              aria-label={`Eliminar a ${p.nombre}`}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showWizard && (
        <NuevoPacienteWizard onClose={() => setShowWizard(false)} onCreado={alCrear} />
      )}

      {aBorrar && (
        <ConfirmarBajaPaciente paciente={aBorrar} onClose={() => setABorrar(null)} />
      )}
    </div>
  );
}
