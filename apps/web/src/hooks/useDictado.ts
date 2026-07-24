'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictado con la Web Speech API del navegador.
 *
 * La V2 transcribe en el navegador y no manda audio a ningún servidor: es
 * gratis, no añade un proveedor que procese voz clínica, y el texto solo sale
 * del equipo cuando el nutriólogo pide estructurarlo. La transcripción de audio
 * grabado (Whisper/Deepgram) queda para la V2.1.
 */

type ResultadoReconocimiento = {
  isFinal: boolean;
  0: { transcript: string };
};

type EventoReconocimiento = {
  resultIndex: number;
  results: { length: number; [indice: number]: ResultadoReconocimiento };
};

type Reconocimiento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((evento: EventoReconocimiento) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type ConstructorReconocimiento = new () => Reconocimiento;

function constructorDisponible(): ConstructorReconocimiento | null {
  if (typeof window === 'undefined') return null;
  const global = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  // Chrome y Edge solo exponen el prefijo `webkit`; Safari y Firefox no lo
  // implementan, y ahí el nutriólogo escribe la nota a mano.
  return global.SpeechRecognition ?? global.webkitSpeechRecognition ?? null;
}

const MENSAJES_ERROR: Record<string, string> = {
  'not-allowed': 'No diste permiso de micrófono. Actívalo en el navegador para dictar.',
  'service-not-allowed': 'El navegador bloqueó el dictado. Revisa los permisos del sitio.',
  'no-speech': 'No se escuchó nada. Acerca el micrófono e intenta de nuevo.',
  'audio-capture': 'No se encontró un micrófono disponible.',
  network: 'El dictado necesita conexión a internet.',
};

export type EstadoDictado = {
  /** `false` en navegadores sin Web Speech API. */
  soportado: boolean;
  dictando: boolean;
  /** Texto confirmado por el reconocedor. */
  texto: string;
  /** Fragmento en curso, aún sin confirmar. */
  parcial: string;
  error: string | null;
};

export function useDictado(textoInicial = '') {
  const [soportado, setSoportado] = useState(false);
  const [dictando, setDictando] = useState(false);
  const [texto, setTexto] = useState(textoInicial);
  const [parcial, setParcial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reconocimiento = useRef<Reconocimiento | null>(null);
  /** Distingue una pausa del reconocedor de una detención pedida por el usuario. */
  const detenidoAdrede = useRef(false);

  useEffect(() => {
    setSoportado(constructorDisponible() !== null);
    return () => {
      detenidoAdrede.current = true;
      reconocimiento.current?.stop();
    };
  }, []);

  const iniciar = useCallback(() => {
    const Constructor = constructorDisponible();
    if (!Constructor) {
      setError('Este navegador no soporta dictado. Escribe la nota a mano.');
      return;
    }

    const instancia = new Constructor();
    instancia.lang = 'es-MX';
    instancia.continuous = true;
    instancia.interimResults = true;

    instancia.onresult = (evento) => {
      let confirmado = '';
      let enCurso = '';
      for (let indice = evento.resultIndex; indice < evento.results.length; indice += 1) {
        const resultado = evento.results[indice] as ResultadoReconocimiento | undefined;
        if (!resultado) continue;
        if (resultado.isFinal) confirmado += resultado[0].transcript;
        else enCurso += resultado[0].transcript;
      }
      if (confirmado) setTexto((previo) => `${previo}${previo ? ' ' : ''}${confirmado.trim()}`);
      setParcial(enCurso);
    };

    instancia.onerror = (evento) => {
      setError(MENSAJES_ERROR[evento.error] ?? 'No se pudo dictar. Intenta de nuevo.');
      detenidoAdrede.current = true;
      setDictando(false);
    };

    instancia.onend = () => {
      setParcial('');
      // El reconocedor se corta solo tras unos segundos de silencio; si el
      // nutriólogo sigue dictando, se reanuda sin que tenga que volver a pulsar.
      if (detenidoAdrede.current) {
        setDictando(false);
        return;
      }
      try {
        instancia.start();
      } catch {
        setDictando(false);
      }
    };

    reconocimiento.current = instancia;
    detenidoAdrede.current = false;
    setError(null);
    setParcial('');
    try {
      instancia.start();
      setDictando(true);
    } catch {
      setError('No se pudo iniciar el dictado. Revisa el micrófono.');
    }
  }, []);

  const detener = useCallback(() => {
    detenidoAdrede.current = true;
    reconocimiento.current?.stop();
    setDictando(false);
    setParcial('');
  }, []);

  const limpiar = useCallback(() => {
    setTexto('');
    setParcial('');
    setError(null);
  }, []);

  return {
    estado: { soportado, dictando, texto, parcial, error } satisfies EstadoDictado,
    iniciar,
    detener,
    limpiar,
    setTexto,
  };
}
