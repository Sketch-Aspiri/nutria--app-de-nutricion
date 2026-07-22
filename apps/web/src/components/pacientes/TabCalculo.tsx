'use client';

import { AlertTriangle, Calculator, CheckCircle2, Flame } from 'lucide-react';
import { useState } from 'react';

import { calcularTDEE, type Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAppState } from '@/store/app-state';

function Dato({ etiqueta, valor, ancho }: { etiqueta: string; valor: React.ReactNode; ancho?: string }) {
  return (
    <div className={`bg-stone-50 rounded-lg p-3 ${ancho ?? ''}`}>
      <div className="text-stone-400 text-xs">{etiqueta}</div>
      <div className="text-emerald-950 font-medium">{valor}</div>
    </div>
  );
}

export function TabCalculo({ paciente }: { paciente: Paciente }) {
  const { updatePatient } = useAppState();
  const [error, setError] = useState<string | null>(null);
  const a = paciente.antropometria;
  const m = paciente.medico;
  const res = paciente.calculo;

  const calcular = () => {
    setError(null);
    try {
      const c = calcularTDEE({
        peso: a.peso,
        altura: a.altura,
        edad: paciente.edad,
        genero: paciente.genero,
        nivelActividad: m.nivelActividad,
        objetivo: m.objetivo,
      });
      updatePatient(paciente.id, { calculo: c });
    } catch {
      setError('El expediente está incompleto: se necesitan peso, altura y edad válidos.');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <SectionCard title="Gasto energético — Mifflin-St Jeor" icon={Calculator}>
        <p className="text-sm text-stone-500 mb-3">
          Cálculo determinístico a partir del expediente. No es una estimación de la IA — es una
          fórmula clínica que puedes defender ante el paciente.
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <Dato etiqueta="Peso" valor={`${a.peso} kg`} />
          <Dato etiqueta="Altura" valor={`${a.altura} cm`} />
          <Dato etiqueta="Edad" valor={`${paciente.edad} años`} />
          <Dato etiqueta="Actividad" valor={m.nivelActividad} />
          <Dato etiqueta="Objetivo" valor={m.objetivo} ancho="col-span-2" />
        </div>
        <Btn onClick={calcular}>
          <Calculator size={16} /> Calcular requerimiento
        </Btn>
        {error && (
          <div className="flex items-center gap-2 text-xs text-orange-600 mt-3">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </SectionCard>

      {res && (
        <SectionCard title="Resultado" icon={Flame}>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <div className="font-mono text-xl text-stone-500">{res.bmr}</div>
              <div className="text-xs text-stone-400">BMR (kcal)</div>
            </div>
            <div>
              <div className="font-mono text-xl text-stone-500">{res.tdee}</div>
              <div className="text-xs text-stone-400">TDEE / mantenimiento</div>
            </div>
            <div>
              <div className="font-mono text-2xl text-emerald-900">{res.objetivoCalorias}</div>
              <div className="text-xs text-stone-400">Objetivo diario</div>
            </div>
          </div>
          <div className="text-xs uppercase tracking-wide text-stone-400 mb-2">
            Distribución de macros
          </div>
          <div className="flex gap-4">
            <div className="flex-1 bg-lime-50 border border-lime-200 rounded-lg p-3">
              <div className="font-mono text-emerald-900 text-lg">{res.proteina_g}g</div>
              <div className="text-xs text-stone-500">Proteína · {res.pPct}%</div>
            </div>
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="font-mono text-emerald-900 text-lg">{res.carbos_g}g</div>
              <div className="text-xs text-stone-500">Carbos · {res.cPct}%</div>
            </div>
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="font-mono text-orange-700 text-lg">{res.grasa_g}g</div>
              <div className="text-xs text-stone-500">Grasa · {res.gPct}%</div>
            </div>
          </div>
          <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-4 flex items-center gap-2">
            <CheckCircle2 size={13} /> Estos valores se usan como meta al generar el plan alimenticio.
          </div>
        </SectionCard>
      )}
    </div>
  );
}
