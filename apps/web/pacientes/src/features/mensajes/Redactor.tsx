'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

/** Tope del servidor (`enviarMensajeSchema`). Se respeta aquí para no mandar un 422. */
const MAX_CARACTERES = 2000;

/**
 * Redactor del hilo.
 *
 * Es un `<form>`, no un `onKeyDown` que espía la tecla Enter como el
 * prototipo: así el teclado de iOS muestra "enviar" en vez de un salto de
 * línea, y el envío funciona igual con teclado físico o lector de pantalla.
 *
 * El texto se limpia solo cuando el envío se acepta. Si falla, se queda escrito
 * —perder lo que uno acaba de teclear por un bache de red es peor que
 * reintentar.
 */
export function Redactor({
  onEnviar,
  enviando,
}: {
  onEnviar: (texto: string) => Promise<unknown>;
  enviando: boolean;
}) {
  const [texto, setTexto] = useState('');
  const limpio = texto.trim();
  const excedido = limpio.length > MAX_CARACTERES;
  const puedeEnviar = limpio.length > 0 && !excedido && !enviando;

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!puedeEnviar) return;

    try {
      await onEnviar(limpio);
      setTexto('');
    } catch {
      // El aviso lo pinta `MensajesCliente` desde el estado de la mutación;
      // aquí solo importa no borrar lo que el paciente escribió.
    }
  };

  return (
    <form
      onSubmit={enviar}
      className="safe-bottom sticky bottom-0 border-t border-stone-200 bg-white px-3 pt-3"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="mensaje" className="sr-only">
          Escribe un mensaje para tu nutrióloga
        </label>
        <textarea
          id="mensaje"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Escribe un mensaje…"
          rows={1}
          className="max-h-32 min-h-[46px] flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-3 text-base focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!puedeEnviar}
          aria-label="Enviar mensaje"
          className="mb-0.5 shrink-0 rounded-full bg-emerald-900 p-3 text-white transition-colors hover:bg-emerald-800 disabled:opacity-40"
        >
          <Send size={18} aria-hidden />
        </button>
      </div>

      {excedido && (
        <p role="alert" className="px-1 pt-1.5 text-[11px] text-red-700">
          Tu mensaje es muy largo: {limpio.length} de {MAX_CARACTERES} caracteres.
        </p>
      )}
    </form>
  );
}
