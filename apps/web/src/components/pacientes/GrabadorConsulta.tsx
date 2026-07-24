'use client';

import { Loader2, Mic, MicOff, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useDictado } from '@/hooks/useDictado';
import { useNotaClinica } from '@/hooks/useNotaClinica';

/**
 * Dictado de consulta y conversión a nota clínica estructurada.
 *
 * El audio nunca sale del navegador: la transcripción la hace la Web Speech API
 * y solo el texto —que el nutriólogo puede editar antes— se manda al servidor
 * para estructurarlo. En navegadores sin soporte queda la captura manual.
 */
export function GrabadorConsulta({ paciente }: { paciente: Paciente }) {
  const [segundos, setSegundos] = useState(0);
  const temporizador = useRef<ReturnType<typeof setInterval> | null>(null);
  const { estado, iniciar, detener, limpiar, setTexto } = useDictado();
  const { procesar, procesando, error } = useNotaClinica(paciente);

  useEffect(() => {
    if (!estado.dictando) {
      if (temporizador.current) clearInterval(temporizador.current);
      return;
    }
    temporizador.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => {
      if (temporizador.current) clearInterval(temporizador.current);
    };
  }, [estado.dictando]);

  const empezar = () => {
    setSegundos(0);
    iniciar();
  };

  const convertir = async () => {
    await procesar(estado.texto);
    limpiar();
    setSegundos(0);
  };

  const reloj = (total: number) =>
    `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

  return (
    <SectionCard title="Dictar consulta y convertirla en nota clínica" icon={Mic}>
      <div className="flex items-center gap-3">
        {!estado.dictando ? (
          <Btn onClick={empezar} size="sm" disabled={!estado.soportado}>
            <Mic size={14} /> Dictar consulta
          </Btn>
        ) : (
          <Btn onClick={detener} size="sm" className="!bg-orange-600 hover:!bg-orange-500">
            <Square size={13} /> Detener
          </Btn>
        )}
        {estado.dictando && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" /> Escuchando{' '}
            {reloj(segundos)}
          </div>
        )}
      </div>

      {!estado.soportado && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-stone-400">
          <MicOff size={12} className="mt-0.5 shrink-0" />
          Este navegador no soporta dictado. Escribe la nota abajo y conviértela igual.
        </p>
      )}
      {estado.error && (
        <p role="alert" className="mt-2 text-xs text-orange-600">
          {estado.error}
        </p>
      )}

      <div className="mb-1 mt-3 text-xs text-stone-400">
        Transcripción (editable) — el audio no sale de tu equipo
      </div>
      <textarea
        value={estado.texto + (estado.parcial ? ` ${estado.parcial}` : '')}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Dicta o escribe aquí lo que ocurrió en la consulta…"
        className="w-full resize-none rounded-lg border border-stone-200 p-3 text-sm focus:border-emerald-400 focus:outline-none"
        rows={4}
      />
      <Btn
        onClick={convertir}
        disabled={procesando || !estado.texto.trim()}
        size="sm"
        className="mt-2"
      >
        {procesando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Convertir en nota clínica
      </Btn>
      {error && (
        <p role="alert" className="mt-2 text-xs text-orange-600">
          {error}
        </p>
      )}
    </SectionCard>
  );
}
