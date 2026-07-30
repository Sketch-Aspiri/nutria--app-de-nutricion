import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/LoginForm';
import { googleHabilitado } from '@/server/auth/config';

export const metadata = { title: 'Iniciar sesión — nutria' };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-emerald-950" />}>
      <LoginForm googleHabilitado={googleHabilitado} />
    </Suspense>
  );
}
