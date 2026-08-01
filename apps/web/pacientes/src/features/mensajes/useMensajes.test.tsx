import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

import * as api from './api';
import { useMensajes, useSinLeer } from './useMensajes';

jest.mock('./api', () => ({
  obtenerMensajes: jest.fn(),
  enviarMensaje: jest.fn(),
  marcarLeidos: jest.fn(),
}));

const obtenerMensajes = api.obtenerMensajes as jest.MockedFunction<typeof api.obtenerMensajes>;

function envoltura() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMensajes y useSinLeer', () => {
  it('comparten llave: observar el hilo y la nav no dispara dos peticiones', async () => {
    // La nav inferior vive en todas las pantallas. Si usara una llave propia,
    // abrir Mensajes duplicaría el sondeo del mismo recurso.
    obtenerMensajes.mockResolvedValue({
      data: [],
      meta: { page: 1, per_page: 0, total: 0, sin_leer: 2 },
    });

    const wrapper = envoltura();
    const hilo = renderHook(() => useMensajes(), { wrapper });
    const nav = renderHook(() => useSinLeer(), { wrapper });

    await waitFor(() => expect(hilo.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(nav.result.current).toBe(2));

    expect(obtenerMensajes).toHaveBeenCalledTimes(1);
  });

  it('la nav no reporta pendientes mientras no haya dato', () => {
    obtenerMensajes.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSinLeer(), { wrapper: envoltura() });

    expect(result.current).toBe(0);
  });
});
