'use client';

import { useRouter } from 'next/navigation';

import { Btn } from '@/components/ui/Btn';
import { useAppState } from '@/store/app-state';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAppState();

  const entrar = () => {
    login();
    router.push('/pacientes');
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
      <div className="bg-stone-50 rounded-2xl max-w-sm w-full p-8 text-center">
        <div className="font-display text-3xl text-emerald-950 font-medium">nutria</div>
        <p className="text-stone-500 text-sm mt-2 mb-6">
          El panel de tus pacientes, planes y seguimiento — con IA integrada.
        </p>
        <Btn onClick={entrar} className="w-full justify-center">
          Iniciar sesión como nutriólogo
        </Btn>
        <div className="text-stone-400 text-xs mt-4">MVP — autenticación real llega con el backend</div>
      </div>
    </div>
  );
}
