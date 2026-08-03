'use client';

import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';

const SELECTOR_FOCO =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function HojaModal({
  titulo,
  descripcion,
  onClose,
  children,
}: {
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const raizRef = useRef<HTMLDivElement>(null);
  const dialogoRef = useRef<HTMLElement>(null);
  const tituloId = useId();
  const descripcionId = useId();

  useLayoutEffect(() => {
    const raiz = raizRef.current;
    const dialogo = dialogoRef.current;
    if (!raiz || !dialogo) return;

    const focoAnterior =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // La hoja no vive en un portal: se vuelven inertes los hermanos en cada
    // nivel de su rama para que ni teclado ni lectores alcancen la app debajo.
    const inertizados: Array<{ elemento: HTMLElement; valor: boolean }> = [];
    let rama: HTMLElement = raiz;
    while (rama.parentElement) {
      const padre = rama.parentElement;
      for (const hermano of Array.from(padre.children)) {
        if (hermano !== rama && hermano instanceof HTMLElement) {
          inertizados.push({ elemento: hermano, valor: Boolean(hermano.inert) });
          hermano.inert = true;
        }
      }
      if (padre === document.body) break;
      rama = padre;
    }

    const elementosEnfocables = () =>
      Array.from(dialogo.querySelectorAll<HTMLElement>(SELECTOR_FOCO)).filter(
        (elemento) => !elemento.hasAttribute('disabled'),
      );

    const manejarTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onClose();
        return;
      }
      if (evento.key !== 'Tab') return;

      const enfocables = elementosEnfocables();
      if (enfocables.length === 0) {
        evento.preventDefault();
        dialogo.focus();
        return;
      }
      const primero = enfocables[0]!;
      const ultimo = enfocables[enfocables.length - 1]!;
      const actual = document.activeElement;

      if (!dialogo.contains(actual)) {
        evento.preventDefault();
        primero.focus();
      } else if (evento.shiftKey && actual === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && actual === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    window.addEventListener('keydown', manejarTeclado);
    elementosEnfocables()[0]?.focus();

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', manejarTeclado);
      for (const { elemento, valor } of inertizados) elemento.inert = valor;
      if (focoAnterior?.isConnected) focoAnterior.focus();
    };
  }, [onClose]);

  return (
    <div ref={raizRef} className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-emerald-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        ref={dialogoRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? descripcionId : undefined}
        className="safe-bottom relative max-h-[92dvh] w-full max-w-app overflow-y-auto rounded-t-[2rem] bg-stone-50 px-5 pb-6 pt-3 shadow-2xl lg:max-w-lg"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-300" />
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={tituloId} className="font-display text-xl font-medium text-emerald-950">
              {titulo}
            </h2>
            {descripcion && (
              <p id={descripcionId} className="mt-0.5 text-xs text-stone-500">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-full bg-white p-2 text-stone-500 shadow-sm ring-1 ring-stone-200"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
