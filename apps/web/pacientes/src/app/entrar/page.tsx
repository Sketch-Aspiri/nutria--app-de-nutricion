import { Suspense } from 'react';

import { EntrarForm } from '@/components/auth/EntrarForm';

export const metadata = { title: 'Entrar — nutria' };

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-emerald-950" />}>
      <EntrarForm />
    </Suspense>
  );
}
