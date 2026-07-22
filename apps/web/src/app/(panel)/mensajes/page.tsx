'use client';

import { Loader2, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { useGenerarTexto } from '@/hooks/useIA';
import { useAppState } from '@/store/app-state';

export default function MensajesPage() {
  const { pacientes, mensajes, setMensajes } = useAppState();
  const [activo, setActivo] = useState(pacientes[0]?.id ?? 0);
  const [texto, setTexto] = useState('');
  const sugerirRespuesta = useGenerarTexto();

  const hilo = mensajes[activo] ?? [];
  const paciente = pacientes.find((p) => p.id === activo);

  const enviar = (t: string) => {
    if (!t.trim()) return;
    setMensajes((m) => ({
      ...m,
      [activo]: [
        ...(m[activo] ?? []),
        {
          de: 'nutriologo',
          texto: t,
          hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    }));
    setTexto('');
  };

  const sugerir = () => {
    if (!paciente) return;
    const ultimo = [...hilo].reverse().find((m) => m.de === 'paciente');
    const prompt = `Eres asistente de un nutriólogo. Redacta una respuesta breve, cálida y profesional para este mensaje de un paciente (${paciente.nombre}, objetivo ${paciente.medico.objetivo}): "${ultimo ? ultimo.texto : 'quiere saber cómo va su progreso'}". Solo el texto de la respuesta.`;
    sugerirRespuesta.mutate(
      { prompt, maxTokens: 200 },
      { onSuccess: (t) => setTexto(t.trim()) },
    );
  };

  return (
    <div className="flex h-full">
      <div className="w-60 border-r border-stone-200 bg-white overflow-auto">
        <div className="p-4 text-xs uppercase tracking-wide text-stone-400">Conversaciones</div>
        {pacientes.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setActivo(p.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
              activo === p.id ? 'bg-emerald-50' : 'hover:bg-stone-50'
            }`}
          >
            <Avatar foto={p.foto} nombre={p.nombre} size={36} />
            <div className="min-w-0">
              <div className="text-sm text-emerald-950 truncate">{p.nombre}</div>
              <div className="text-xs text-stone-400 truncate">
                {(mensajes[p.id] ?? []).slice(-1)[0]?.texto ?? 'Sin mensajes'}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex items-center gap-3">
          <Avatar foto={paciente?.foto ?? null} nombre={paciente?.nombre ?? '?'} size={36} />
          <div className="text-sm text-emerald-950 font-medium">{paciente?.nombre}</div>
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 ml-auto">
            <ShieldCheck size={12} /> Cifrado extremo a extremo
          </span>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-3 bg-stone-50">
          {hilo.length === 0 && (
            <div className="text-sm text-stone-400 text-center mt-8">
              Inicia la conversación con {paciente?.nombre}.
            </div>
          )}
          {hilo.map((m, i) => (
            <div key={i} className={`flex ${m.de === 'nutriologo' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                  m.de === 'nutriologo'
                    ? 'bg-emerald-900 text-white'
                    : 'bg-white border border-stone-200 text-emerald-950'
                }`}
              >
                {m.texto}
                <div className={`text-[10px] mt-1 ${m.de === 'nutriologo' ? 'text-emerald-300' : 'text-stone-400'}`}>
                  {m.hora}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-stone-200 bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={sugerir}
              disabled={sugerirRespuesta.isPending}
              title="Sugerir respuesta con IA"
              className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-2 disabled:opacity-50"
            >
              {sugerirRespuesta.isPending ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </button>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviar(texto)}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => enviar(texto)}
              className="bg-emerald-900 text-white rounded-lg p-2 hover:bg-emerald-800"
              aria-label="Enviar"
            >
              <Send size={18} />
            </button>
          </div>
          {sugerirRespuesta.isError && (
            <div className="text-orange-600 text-xs mt-2">{sugerirRespuesta.error.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
