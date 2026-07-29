'use client';

import { Camera, Dumbbell, Scale, Utensils } from 'lucide-react';
import { useState } from 'react';

import { HojaModal } from '@/components/ui/HojaModal';

import { FormComida } from './FormComida';
import { FormEjercicio } from './FormEjercicio';
import { FormFoto } from './FormFoto';
import { FormPeso } from './FormPeso';

type Modo = 'menu' | 'comida' | 'foto' | 'peso' | 'ejercicio';

const OPCIONES = [
  {
    modo: 'comida',
    titulo: 'Una comida',
    descripcion: 'La IA estima sus macros',
    icono: Utensils,
    colores: 'bg-emerald-50 text-emerald-700',
    requiereDia: false,
  },
  {
    modo: 'foto',
    titulo: 'Foto',
    descripcion: 'Guarda una imagen del plato',
    icono: Camera,
    colores: 'bg-amber-50 text-amber-700',
    requiereDia: false,
  },
  {
    modo: 'peso',
    titulo: 'Peso',
    descripcion: 'Tu lectura de hoy',
    icono: Scale,
    colores: 'bg-sky-50 text-sky-700',
    requiereDia: true,
  },
  {
    modo: 'ejercicio',
    titulo: 'Ejercicio',
    descripcion: 'Actividad y duración',
    icono: Dumbbell,
    colores: 'bg-violet-50 text-violet-700',
    requiereDia: true,
  },
] as const;

export function RegistroSheet({
  dia,
  cargandoDia,
  onClose,
  onSuccess,
}: {
  dia: string | null;
  cargandoDia: boolean;
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}) {
  const [modo, setModo] = useState<Modo>('menu');
  const volver = () => setModo('menu');
  const completar = (mensaje: string) => () => onSuccess(mensaje);

  return (
    <HojaModal
      titulo={modo === 'menu' ? '¿Qué quieres registrar?' : tituloDe(modo)}
      descripcion={modo === 'menu' ? 'Mantén al día lo que haces por ti.' : undefined}
      onClose={onClose}
    >
      {modo === 'menu' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {OPCIONES.map(
              ({ modo: destino, titulo, descripcion, icono: Icono, colores, requiereDia }) => {
                const deshabilitada = requiereDia && !dia;
                return (
                  <button
                    key={destino}
                    type="button"
                    disabled={deshabilitada}
                    onClick={() => setModo(destino)}
                    className="flex min-h-36 flex-col items-start rounded-2xl border border-stone-200 bg-white p-4 text-left transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-45"
                  >
                    <span className={`rounded-full p-2.5 ${colores}`}>
                      <Icono size={19} aria-hidden />
                    </span>
                    <span className="mt-3 text-sm font-medium text-emerald-950">{titulo}</span>
                    <span className="mt-0.5 text-[11px] leading-snug text-stone-400">
                      {descripcion}
                    </span>
                  </button>
                );
              },
            )}
          </div>
          {!dia && (
            <p
              role="status"
              className="mt-3 text-center text-[11px] leading-relaxed text-stone-500"
            >
              {cargandoDia
                ? 'Verificando la fecha de tu consultorio para peso y ejercicio…'
                : 'No pudimos verificar la fecha clínica. Peso y ejercicio se habilitarán al recuperar la conexión.'}
            </p>
          )}
        </>
      )}
      {modo === 'comida' && (
        <FormComida onAtras={volver} onHecho={completar('Comida agregada a tu día.')} />
      )}
      {modo === 'foto' && (
        <FormFoto onAtras={volver} onHecho={completar('Foto guardada en tu día.')} />
      )}
      {modo === 'peso' && dia && (
        <FormPeso dia={dia} onAtras={volver} onHecho={completar('Peso actualizado.')} />
      )}
      {modo === 'ejercicio' && dia && (
        <FormEjercicio dia={dia} onAtras={volver} onHecho={completar('Ejercicio registrado.')} />
      )}
    </HojaModal>
  );
}

function tituloDe(modo: Exclude<Modo, 'menu'>): string {
  return {
    comida: 'Describe tu comida',
    foto: 'Foto de tu comida',
    peso: 'Registra tu peso',
    ejercicio: 'Registra tu ejercicio',
  }[modo];
}
