import { ProgresoCliente } from '@/features/progreso/ProgresoCliente';

export const metadata = { title: 'Tu progreso — nutria' };

/**
 * No necesita límite de Suspense: a diferencia de `/plan`, esta pantalla no lee
 * la query con `useSearchParams`; todo su estado viene de React Query.
 */
export default function ProgresoPage() {
  return <ProgresoCliente />;
}
