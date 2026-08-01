import { Suspense } from 'react';

import { PlanCliente } from '@/features/plan/PlanCliente';

export const metadata = { title: 'Tu plan — nutria' };

/**
 * La pestaña activa se lee de la query con `useSearchParams`, y eso obliga a un
 * límite de Suspense: sin él, Next no puede prerenderizar nada de esta rama.
 * El fallback es el fondo de la app, no un esqueleto de tarjetas: las tarjetas
 * falsas de un plan que aún no llegó son justo lo que no queremos mostrar.
 */
export default function PlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PlanCliente />
    </Suspense>
  );
}
