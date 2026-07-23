'use client';

import { Check, Loader2, Ruler } from 'lucide-react';
import { useState } from 'react';

import type { Antropometria, Pliegues } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { inputClass as inp, labelClass as lbl } from '@/components/ui/campos';
import { useAgregarMedicion } from '@/hooks/usePacientes';
import { ApiError } from '@/services/pacientes';

const CAMPOS = [
  { clave: 'tricipital', etiqueta: 'Tricipital (mm)' },
  { clave: 'bicipital', etiqueta: 'Bicipital (mm)' },
  { clave: 'subescapular', etiqueta: 'Subescapular (mm)' },
  { clave: 'suprailiaco', etiqueta: 'Suprailiaco (mm)' },
] as const;

type Formulario = Record<(typeof CAMPOS)[number]['clave'], string>;

function formularioDesde(pliegues: Pliegues | null): Formulario {
  return {
    tricipital: pliegues?.tricipital?.toString() ?? '',
    bicipital: pliegues?.bicipital?.toString() ?? '',
    subescapular: pliegues?.subescapular?.toString() ?? '',
    suprailiaco: pliegues?.suprailiaco?.toString() ?? '',
  };
}

function numeroValido(valor: string): number | null {
  const numero = Number(valor);
  return valor.trim() !== '' && Number.isFinite(numero) && numero > 0 ? numero : null;
}

type Props = {
  pacienteId: string;
  antropometria: Antropometria;
};

/**
 * Captura de los cuatro pliegues de Durnin-Womersley.
 *
 * Se guarda como una **nueva toma de medidas**, no como parche de la anterior:
 * una plicometría es una medición fechada del expediente. Por eso arrastra
 * peso, altura y circunferencias vigentes — si no, la toma nueva pasaría a ser
 * la más reciente sin peso y el resto del panel se quedaría sin datos.
 */
export function FormPliegues({ pacienteId, antropometria }: Props) {
  const [form, setForm] = useState<Formulario>(() => formularioDesde(antropometria.pliegues));
  const [guardado, setGuardado] = useState(false);
  const agregar = useAgregarMedicion(pacienteId);

  const capturados = CAMPOS.map(({ clave }) => numeroValido(form[clave]));
  const completos = capturados.every((valor) => valor !== null);

  const guardar = () => {
    setGuardado(false);
    const pliegues: Pliegues = {};
    for (const [indice, { clave }] of CAMPOS.entries()) {
      const valor = capturados[indice];
      if (valor !== null) pliegues[clave] = valor;
    }

    agregar.mutate(
      {
        peso_kg: antropometria.peso || null,
        altura_cm: antropometria.altura || null,
        cintura_cm: antropometria.cintura || null,
        cadera_cm: antropometria.cadera || null,
        grasa_pct: antropometria.grasaCorporal || null,
        pliegues,
      },
      { onSuccess: () => setGuardado(true) },
    );
  };

  const error = agregar.error;

  return (
    <SectionCard title="Pliegues cutáneos" icon={Ruler}>
      <p className="text-sm text-stone-500 mb-3">
        Con los cuatro pliegues se estima el % de grasa por Durnin-Womersley y se habilita la
        ecuación de Katch-McArdle. Se guarda como una nueva toma de medidas fechada hoy.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CAMPOS.map(({ clave, etiqueta }) => (
          <div key={clave}>
            <label className={lbl} htmlFor={`pliegue-${clave}`}>
              {etiqueta}
            </label>
            <input
              id={`pliegue-${clave}`}
              type="number"
              min="0"
              max="100"
              step="0.5"
              inputMode="decimal"
              className={inp}
              value={form[clave]}
              onChange={(evento) => {
                setGuardado(false);
                setForm((previo) => ({ ...previo, [clave]: evento.target.value }));
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Btn variant="outline" size="sm" onClick={guardar} disabled={!completos || agregar.isPending}>
          {agregar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ruler size={14} />}
          Guardar pliegues
        </Btn>
        {!completos && (
          <span className="text-xs text-stone-400">
            La ecuación necesita los cuatro pliegues para no quedar sesgada.
          </span>
        )}
        {guardado && !agregar.isPending && (
          <span className="flex items-center gap-1 text-xs text-emerald-700">
            <Check size={13} /> Medición registrada
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-orange-700 mt-3">
          {error instanceof ApiError ? error.message : 'No pudimos guardar la medición.'}
        </div>
      )}
    </SectionCard>
  );
}
