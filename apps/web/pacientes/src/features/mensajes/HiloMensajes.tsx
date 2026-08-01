'use client';

import { useEffect, useRef } from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';

import { agruparPorDia, horaCorta } from './calculos';
import type { MensajeEnPantalla } from './types';

/**
 * El hilo, con separadores de día y burbujas alineadas por emisor.
 *
 * Baja solo al último mensaje cuando llega uno nuevo. No se usa
 * `scrollIntoView` sobre el documento: dentro de una PWA con barra inferior
 * fija, eso desplaza la página completa y deja el redactor debajo del pliegue.
 */
export function HiloMensajes({ mensajes }: { mensajes: MensajeEnPantalla[] }) {
  const finalRef = useRef<HTMLDivElement>(null);
  const grupos = agruparPorDia(mensajes);
  const ultimo = mensajes[mensajes.length - 1];

  useEffect(() => {
    const final = finalRef.current;
    // `scrollIntoView` no existe en todos los entornos (jsdom, por ejemplo, no
    // lo implementa). Bajar al último mensaje es una comodidad: que falte no
    // puede tumbar el hilo, que es el contenido.
    if (typeof final?.scrollIntoView === 'function') final.scrollIntoView({ block: 'end' });
    // Se re-ejecuta cuando cambia el último mensaje, no en cada render del
    // sondeo: si nada llegó, el paciente no pierde su posición de lectura.
  }, [ultimo?.id, mensajes.length]);

  return (
    <div className="px-5 pb-4">
      {grupos.map((grupo) => (
        <section key={grupo.dia} aria-label={grupo.etiqueta}>
          <p className="my-3 text-center text-[10px] font-medium uppercase tracking-wide text-stone-400">
            {grupo.etiqueta}
          </p>
          <ul className="space-y-2">
            {grupo.mensajes.map((mensaje) => (
              <Burbuja key={mensaje.id} mensaje={mensaje} />
            ))}
          </ul>
        </section>
      ))}
      <div ref={finalRef} />
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeEnPantalla }) {
  const mio = mensaje.emisor === 'PATIENT';

  return (
    <li className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
          mio
            ? 'bg-emerald-900 text-white'
            : 'border border-stone-200 bg-white text-emerald-950'
        } ${mensaje.pendiente ? 'opacity-60' : ''}`}
      >
        {/* Los saltos de línea que escribió quien lo mandó se respetan. */}
        <p className="whitespace-pre-line break-words">{mensaje.texto}</p>
        <p
          className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
            mio ? 'text-emerald-300' : 'text-stone-400'
          }`}
        >
          <span>{horaCorta(mensaje.created_at)}</span>
          {mio && <AcuseDeEnvio mensaje={mensaje} />}
        </p>
      </div>
    </li>
  );
}

/**
 * Estado de un mensaje propio: enviándose, enviado o leído.
 *
 * El icono nunca va solo: cada estado lleva su texto para lector de pantalla,
 * porque una palomita doble no significa nada para quien no la ve.
 */
function AcuseDeEnvio({ mensaje }: { mensaje: MensajeEnPantalla }) {
  if (mensaje.pendiente) {
    return (
      <>
        <Clock size={11} aria-hidden />
        <span className="sr-only">Enviando</span>
      </>
    );
  }

  if (mensaje.leido_at) {
    return (
      <>
        <CheckCheck size={12} aria-hidden />
        <span className="sr-only">Leído</span>
      </>
    );
  }

  return (
    <>
      <Check size={12} aria-hidden />
      <span className="sr-only">Enviado</span>
    </>
  );
}
