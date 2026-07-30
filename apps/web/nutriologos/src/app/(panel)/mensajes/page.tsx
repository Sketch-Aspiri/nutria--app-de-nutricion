'use client';

import { ChevronLeft, Loader2, Send, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { useGenerarIA } from '@/hooks/useIA';
import { useConversaciones, useEnviarMensaje, useHilo, useMarcarLeido } from '@/hooks/useMensajes';

const HORA = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' });

export default function MensajesPage() {
  const { conversaciones, cargando } = useConversaciones();
  const [activo, setActivo] = useState('');
  const [texto, setTexto] = useState('');
  const finDelHilo = useRef<HTMLDivElement>(null);

  const { mensajes, cargando: cargandoHilo } = useHilo(activo);
  const enviar = useEnviarMensaje(activo);
  const sugerirRespuesta = useGenerarIA();

  const conversacion = conversaciones.find((c) => c.patient_id === activo);
  useMarcarLeido(activo, conversacion?.sin_leer ?? 0);

  // Al abrir un hilo o recibir un mensaje, la vista salta al final.
  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length, activo]);

  const mandar = () => {
    const limpio = texto.trim();
    if (!limpio || !activo || enviar.isPending) return;
    // El input se limpia al confirmar el servidor, no antes: si falla el envío
    // el nutriólogo conserva lo que escribió.
    enviar.mutate(limpio, { onSuccess: () => setTexto('') });
  };

  /**
   * El prompt lo arma el servidor a partir del expediente y del último mensaje
   * del paciente; aquí solo se manda la intención, para que el nombre nunca
   * salga hacia el proveedor de IA.
   */
  const sugerir = () => {
    if (!activo) return;
    const ultimo = [...mensajes].reverse().find((m) => m.emisor === 'PATIENT');
    sugerirRespuesta.mutate(
      {
        tipo: 'RESPUESTA_MENSAJE',
        patient_id: activo,
        mensaje: ultimo?.texto ?? 'Quiere saber cómo va su progreso.',
      },
      { onSuccess: (salida) => setTexto(salida.texto ?? '') },
    );
  };

  return (
    // En móvil no caben las dos columnas: se ve la lista y, al elegir un
    // paciente, el hilo la reemplaza con una flecha para volver.
    <div className="flex h-full">
      <div
        className={`w-full shrink-0 overflow-auto border-r border-stone-200 bg-white lg:block lg:w-64 ${
          activo ? 'hidden' : 'block'
        }`}
      >
        <div className="p-4 text-xs uppercase tracking-wide text-stone-400">Conversaciones</div>
        {cargando && <div className="px-4 text-sm text-stone-400">Cargando…</div>}
        {!cargando && conversaciones.length === 0 && (
          <div className="px-4 text-sm text-stone-400">
            Da de alta a un paciente para empezar a conversar.
          </div>
        )}
        {conversaciones.map((c) => (
          <button
            type="button"
            key={c.patient_id}
            onClick={() => setActivo(c.patient_id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
              activo === c.patient_id ? 'bg-emerald-50' : 'hover:bg-stone-50'
            }`}
          >
            <Avatar foto={c.paciente.foto_url} nombre={c.paciente.nombre} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-emerald-950 truncate">{c.paciente.nombre}</div>
              <div className="text-xs text-stone-400 truncate">
                {c.ultimo_mensaje?.texto ?? 'Sin mensajes'}
              </div>
            </div>
            {c.sin_leer > 0 && (
              <span
                className="shrink-0 bg-emerald-700 text-white text-[10px] rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center"
                aria-label={`${c.sin_leer} mensajes sin leer`}
              >
                {c.sin_leer}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={`min-w-0 flex-1 flex-col lg:flex ${activo ? 'flex' : 'hidden'}`}>
        {!activo ? (
          <div className="flex-1 flex items-center justify-center text-sm text-stone-400">
            Elige una conversación para empezar.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setActivo('')}
                aria-label="Volver a conversaciones"
                className="-ml-1 rounded-lg p-2 text-stone-500 hover:bg-stone-100 lg:hidden"
              >
                <ChevronLeft size={20} />
              </button>
              <Avatar
                foto={conversacion?.paciente.foto_url ?? null}
                nombre={conversacion?.paciente.nombre ?? '?'}
                size={36}
              />
              <div className="text-sm text-emerald-950 font-medium">
                {conversacion?.paciente.nombre}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto bg-stone-50 p-3 sm:p-6">
              {cargandoHilo && (
                <div className="text-sm text-stone-400 text-center">Cargando mensajes…</div>
              )}
              {!cargandoHilo && mensajes.length === 0 && (
                <div className="text-sm text-stone-400 text-center mt-8">
                  Inicia la conversación con {conversacion?.paciente.nombre}.
                </div>
              )}
              {mensajes.map((m) => {
                const propio = m.emisor === 'NUTRITIONIST';
                return (
                  <div key={m.id} className={`flex ${propio ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm sm:max-w-xs ${
                        propio
                          ? 'bg-emerald-900 text-white'
                          : 'bg-white border border-stone-200 text-emerald-950'
                      }`}
                    >
                      {m.texto}
                      <div
                        className={`text-[10px] mt-1 ${propio ? 'text-emerald-300' : 'text-stone-400'}`}
                      >
                        {HORA.format(new Date(m.created_at))}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={finDelHilo} />
            </div>

            <div className="border-t border-stone-200 bg-white p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sugerir}
                  disabled={sugerirRespuesta.isPending}
                  title="Sugerir respuesta con IA"
                  aria-label="Sugerir respuesta con IA"
                  className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-2 disabled:opacity-50"
                >
                  {sugerirRespuesta.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </button>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && mandar()}
                  placeholder="Escribe un mensaje..."
                  aria-label="Mensaje"
                  className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={mandar}
                  disabled={enviar.isPending || !texto.trim()}
                  className="bg-emerald-900 text-white rounded-lg p-2 hover:bg-emerald-800 disabled:opacity-50"
                  aria-label="Enviar"
                >
                  {enviar.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              {/* La sugerencia de IA es un borrador: el nutriólogo la edita y
                  decide si se envía (regla de `rules/ai-guidelines.md`). */}
              {sugerirRespuesta.isSuccess && (
                <div className="text-xs text-stone-400 mt-2">
                  Borrador sugerido por IA — revísalo antes de enviarlo.
                </div>
              )}
              {sugerirRespuesta.isError && (
                <div className="text-orange-600 text-xs mt-2">
                  {sugerirRespuesta.error.message}
                </div>
              )}
              {enviar.isError && (
                <div className="text-orange-600 text-xs mt-2">
                  No pudimos enviar el mensaje. Intenta de nuevo.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
