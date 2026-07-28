'use client';

import { X } from 'lucide-react';

type ModalProps = {
  children: React.ReactNode;
  wide?: boolean;
};

export function Modal({ children, wide }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-emerald-950/40 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-stone-50 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-auto`}
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
