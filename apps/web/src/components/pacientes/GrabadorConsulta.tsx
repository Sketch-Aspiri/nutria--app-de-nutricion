'use client';

import { Loader2, Mic, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Paciente } from '@nutria/shared';

import { Btn } from '@/components/ui/Btn';
import { SectionCard } from '@/components/ui/SectionCard';
import { useNotaClinica } from '@/hooks/useNotaClinica';

// Transcripción simulada: la captura de audio real (Web Speech / Whisper) llega post-MVP.
const TRANSCRIPT_DEMO =
  'Paciente refiere que ha bajado dos kilos desde la última cita. Comenta que le cuesta desayunar por las mañanas por falta de tiempo. Duerme alrededor de seis horas. Tiene antojos de dulce por la tarde. Menciona que empezó a caminar tres veces por semana. Sin cambios en medicamentos.';

export function GrabadorConsulta({ paciente }: { paciente: Paciente }) {
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcript, setTranscript] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { procesar, procesando } = useNotaClinica(paciente);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const iniciar = () => {
    setGrabando(true);
    setSegundos(0);
    setTranscript('');
    timer.current = setInterval(() => setSegundos((s) => s + 1), 1000);
  };
  const detener = () => {
    setGrabando(false);
    if (timer.current) clearInterval(timer.current);
    setTranscript(TRANSCRIPT_DEMO);
  };
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const convertir = async () => {
    await procesar(transcript);
    setTranscript('');
  };

  return (
    <SectionCard title="Grabar consulta y transcribir con IA" icon={Mic}>
      <div className="flex items-center gap-3">
        {!grabando ? (
          <Btn onClick={iniciar} size="sm">
            <Mic size={14} /> Grabar consulta
          </Btn>
        ) : (
          <Btn onClick={detener} size="sm" className="!bg-orange-600 hover:!bg-orange-500">
            <Square size={13} /> Detener
          </Btn>
        )}
        {grabando && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Grabando {fmt(segundos)}
          </div>
        )}
      </div>
      {transcript && (
        <>
          <div className="text-xs text-stone-400 mt-3 mb-1">Transcripción (editable)</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400"
            rows={3}
          />
          <Btn onClick={convertir} disabled={procesando} size="sm" className="mt-2">
            {procesando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Convertir en nota clínica
          </Btn>
        </>
      )}
    </SectionCard>
  );
}
