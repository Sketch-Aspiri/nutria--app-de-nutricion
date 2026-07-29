import { Suspense } from 'react';

import { PRIVACY_NOTICE_VERSION } from '@/config/privacy';
import { ActivarForm } from '@/components/auth/ActivarForm';

export const metadata = { title: 'Activa tu cuenta — nutria' };

export default function ActivarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-emerald-950" />}>
      <ActivarForm version={PRIVACY_NOTICE_VERSION} />
    </Suspense>
  );
}
