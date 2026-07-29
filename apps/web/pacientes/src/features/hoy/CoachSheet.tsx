'use client';

import { Loader2, Send, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { HojaModal } from '@/components/ui/HojaModal';

import type { TurnoCoach } from './types';
import { usePreguntarCoach } from './useRegistro';

const SUGERENCIAS = [
  '¿Puedo cambiar la cena?',
  '¿Cuánta agua debo tomar?',
  'Tengo antojo de algo dulce',
];

export function CoachSheet({ onClose }: { onClose: () => void }) {
  const [texto, setTexto] = useState('');
  const [hilo, setHilo] = useState<TurnoCoach[]>([]);
  const preguntar = usePreguntarCoach();

  const enviar = async (mensaje: string) => {
    const limpio = mensaje.trim();
    if (!limpio || preguntar.isPending) return;

    const historial = hilo.slice(-6);
    setHilo((actual) => [...actual, { rol: 'paciente', texto: limpio }]);
    setTexto('');
    try {
      const respuesta = await preguntar.mutateAsync({ mensaje: limpio, historial });
      setHilo((actual) => [...actual, { rol: 'coach', texto: respuesta.texto }]);
    } catch {
      // El turno del paciente se conserva para que pueda reintentar sin
      // reescribirlo; el error visible explica que no se obtuvo respuesta.
    }
  };

  const enviarFormulario = (evento: React.FormEvent) => {
    evento.preventDefault();
    void enviar(texto);
  };

  return (
    <HojaModal
      titulo="Tu coach"
      descripcion="Orientación general con IA; no sustituye a tu nutrióloga."
      onClose={onClose}
    >
      <div className="mb-4 min-h-48 space-y-2.5">
        <Burbuja rol="coach">
          Hola. Puedo ayudarte a entender tu plan o pensar alternativas sencillas.
        </Burbuja>
        {hilo.map((turno, indice) => (
          <Burbuja key={`${turno.rol}-${indice}`} rol={turno.rol}>
            {turno.texto}
          </Burbuja>
        ))}
        {preguntar.isPending && (
          <Burbuja rol="coach">
            <Loader2 size={16} className="animate-spin" aria-label="Pensando" />
          </Burbuja>
        )}
        {preguntar.isError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
            {preguntar.error.message}
          </p>
        )}
      </div>

      {hilo.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGERENCIAS.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => void enviar(sugerencia)}
              className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
            >
              {sugerencia}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={enviarFormulario} className="flex items-center gap-2">
        <label htmlFor="pregunta-coach" className="sr-only">
          Pregunta para el coach
        </label>
        <input
          id="pregunta-coach"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          maxLength={1000}
          placeholder="Escribe tu duda…"
          className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={preguntar.isPending || !texto.trim()}
          className="rounded-full bg-emerald-900 p-3 text-white disabled:opacity-40"
        >
          <Send size={18} aria-hidden />
        </button>
      </form>
      <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-stone-400">
        <Sparkles size={10} aria-hidden />
        No compartas nombres, teléfonos ni otros datos personales.
      </p>
    </HojaModal>
  );
}

function Burbuja({ rol, children }: { rol: TurnoCoach['rol']; children: React.ReactNode }) {
  return (
    <div className={`flex ${rol === 'paciente' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          rol === 'paciente'
            ? 'rounded-br-md bg-emerald-900 text-white'
            : 'rounded-bl-md border border-stone-200 bg-white text-emerald-950'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
