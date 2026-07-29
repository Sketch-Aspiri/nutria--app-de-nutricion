'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';

/**
 * Providers de la app del paciente.
 *
 * Sin `AppStateProvider`: ese store es del panel (filtros de listados, estado
 * de la barra lateral) y aquí no hay nada equivalente todavía. Si la fase 7 lo
 * necesita, entra entonces.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos de un teléfono en red móvil: reintentar una vez cubre el
            // corte típico de túnel o cambio de antena sin castigar la batería.
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
