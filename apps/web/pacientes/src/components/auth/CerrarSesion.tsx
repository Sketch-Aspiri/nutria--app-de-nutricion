'use client';

import { signOut } from 'next-auth/react';

import { Btn } from '@/components/ui/Btn';

export function CerrarSesion() {
  return (
    <Btn
      variant="ghost"
      className="w-full border border-stone-200 bg-white"
      // `redirectTo` explícito: el default de Auth.js es `/`, y desde ahí el
      // middleware rebotaría a /entrar con un `callbackUrl` que ya no aplica.
      onClick={() => void signOut({ redirectTo: '/entrar' })}
    >
      Cerrar sesión
    </Btn>
  );
}
