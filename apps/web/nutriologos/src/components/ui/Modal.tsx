'use client';

import { X } from 'lucide-react';

type ModalProps = {
  children: React.ReactNode;
  wide?: boolean;
};

export function Modal({ children, wide }: ModalProps) {
  return (
    // `dvh` en vez de `vh`: en móvil la barra del navegador se contrae y con
    // `vh` el pie del modal (los botones de guardar) queda fuera de pantalla.
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-emerald-950/40 p-0 sm:items-center sm:p-4">
      <div
        className={`max-h-[92dvh] w-full overflow-auto rounded-t-2xl bg-stone-50 sm:max-h-[90dvh] sm:rounded-2xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
};

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="font-display text-lg text-emerald-950 font-medium">{title}</div>
      <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Cerrar">
        <X size={18} />
      </button>
    </div>
  );
}
