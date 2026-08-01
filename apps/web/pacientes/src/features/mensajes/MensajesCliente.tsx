'use client';

import { MessageCircle, ShieldCheck } from 'lucide-react';

import { iniciales } from '@/components/ui/Avatar';
import { Cargando, ErrorDeCarga } from '@/components/ui/Estados';
import { usePerfil } from '@/features/perfil/usePerfil';

import { ordenarMensajes, sinLeerDe } from './calculos';
import { HiloMensajes } from './HiloMensajes';
import { Redactor } from './Redactor';
import { useEnviarMensaje, useMarcarLeidos, useMensajes } from './useMensajes';

/**
 * Pantalla Mensajes: el hilo real con la nutrióloga.
 *
 * **Aquí desaparece la simulación.** El prototipo respondía solo: un
 * `setTimeout` de 1.2 s inyectaba "¡Gracias por avisarme, Camila! Lo reviso y
 * te comento." como si lo hubiera escrito la profesional. En una app de salud
 * eso no es una maqueta inofensiva —es ponerle palabras en la boca a quien
 * responde por el tratamiento—. Lo que se ve en este hilo salió de la tabla
 * `messages`, que es la misma que lee el panel del otro lado.
 *
 * No lleva `Pantalla`: este es el único destino de la nav que ocupa el alto
 * completo, con encabezado fijo arriba y redactor pegado abajo.
 */
export function MensajesCliente() {
  const consulta = useMensajes();
  const perfil = usePerfil();
  const envio = useEnviarMensaje();

  useMarcarLeidos(sinLeerDe(consulta.data));

  const nutriologa = perfil.data?.nutriologo.nombre ?? '';

  return (
    <main className="flex min-h-screen flex-col pb-nav">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white px-5 py-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-sm font-medium text-white"
        >
          {iniciales(nutriologa) || '·'}
        </span>
        <div className="min-w-0">
          {/* Sin nombre todavía, "Tu nutrióloga" dice la verdad; un nombre de
              ejemplo diría una mentira sobre quién la atiende. */}
          <h1 className="truncate text-sm font-medium text-emerald-950">
            {nutriologa || 'Tu nutrióloga'}
          </h1>
          <p className="flex items-center gap-1 text-[11px] text-emerald-600">
            <ShieldCheck size={11} aria-hidden />
            Te responde ella, no un asistente
          </p>
        </div>
      </header>

      <div className="flex-1">
        <CuerpoDelHilo consulta={consulta} />
      </div>

      {envio.isError && (
        <p role="alert" className="px-5 pb-1 pt-2 text-center text-[11px] text-red-700">
          {envio.error.message}
        </p>
      )}

      <Redactor onEnviar={(texto) => envio.mutateAsync(texto)} enviando={envio.isPending} />
    </main>
  );
}

/**
 * Cuerpo del hilo, en su propio componente de nivel superior.
 *
 * Declararlo dentro de `MensajesCliente` le daría identidad nueva en cada
 * render, y con un sondeo cada 15 s eso desmontaría el hilo —y la posición de
 * lectura— cuatro veces por minuto.
 */
function CuerpoDelHilo({ consulta }: { consulta: ReturnType<typeof useMensajes> }) {
  if (consulta.isPending) return <Cargando etiqueta="Cargando tus mensajes" />;

  if (consulta.isError) {
    return (
      <ErrorDeCarga
        titulo="No pudimos cargar tus mensajes"
        onReintentar={() => consulta.refetch()}
      />
    );
  }

  const mensajes = ordenarMensajes(consulta.data.data);
  if (mensajes.length === 0) return <HiloVacio />;

  return <HiloMensajes mensajes={mensajes} />;
}

function HiloVacio() {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="rounded-full bg-stone-100 p-3 text-stone-400">
        <MessageCircle size={22} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium text-emerald-950">
        Aquí vas a hablar con tu nutrióloga
      </p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-stone-500">
        Dudas del plan, cambios de horario o cómo te sentiste esta semana. Escribe el primero.
      </p>
    </div>
  );
}
