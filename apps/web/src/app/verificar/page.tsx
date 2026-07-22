import { Suspense } from 'react';

import { VerificarPanel } from '@/components/auth/VerificarPanel';

export const metadata = { title: 'Confirmar correo — nutria' };

export default function VerificarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-emerald-950" />}>
      <VerificarPanel />
    </Suspense>
  );
}
