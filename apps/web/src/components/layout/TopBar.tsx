'use client';

import { CreditCard } from 'lucide-react';
import { useState } from 'react';

import { Btn } from '@/components/ui/Btn';
import { Modal, ModalHeader } from '@/components/ui/Modal';

function SubscriptionModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal>
      <div className="p-6">
        <ModalHeader title="Suscripción Pro" onClose={onClose} />
        <CreditCard className="text-emerald-800 mb-3" size={22} />
        <p className="text-sm text-stone-500 leading-relaxed">
          Pacientes ilimitados, IA para planes y recetas, y reportes automáticos.
        </p>
        <div className="mt-4 bg-white rounded-xl p-4 text-sm space-y-2 border border-stone-200">
          <div className="flex justify-between text-stone-500">
            <span>Próximo cobro</span>
            <span className="text-stone-800 font-medium">1 ago 2026</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Monto</span>
            <span className="text-stone-800 font-medium">$499 MXN/mes</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Generaciones IA incluidas</span>
            <span className="text-stone-800 font-medium">150 / mes</span>
          </div>
        </div>
        <Btn onClick={onClose} className="w-full justify-center mt-5">
          Gestionar suscripción
        </Btn>
      </div>
    </Modal>
  );
}

export function TopBar() {
  const [showSub, setShowSub] = useState(false);
  return (
    <div className="flex justify-end px-8 py-4 border-b border-stone-200 bg-white shrink-0">
      <button
        type="button"
        onClick={() => setShowSub(true)}
        className="flex items-center gap-2 bg-white border border-stone-200 rounded-full pl-3 pr-4 py-1.5 text-xs hover:border-emerald-300 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-lime-500" />
        <span className="text-stone-600">
          Plan <span className="font-semibold text-emerald-900">Pro</span>
        </span>
      </button>
      {showSub && <SubscriptionModal onClose={() => setShowSub(false)} />}
    </div>
  );
}
