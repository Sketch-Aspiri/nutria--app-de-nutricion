import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import * as api from './api';
import { useDescargarMisDatos } from './usePerfil';

jest.mock('./api', () => ({
  obtenerPerfil: jest.fn(),
  cambiarPassword: jest.fn(),
  darDeBaja: jest.fn(),
  descargarMisDatos: jest.fn(),
}));

const descargarMisDatos = api.descargarMisDatos as jest.MockedFunction<
  typeof api.descargarMisDatos
>;

function envoltura({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDescargarMisDatos', () => {
  const revocar = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.revokeObjectURL = revocar as unknown as typeof URL.revokeObjectURL;
  });

  it('dispara la descarga con el nombre de archivo y limpia el objectURL', async () => {
    descargarMisDatos.mockResolvedValue({
      nombreArchivo: 'mis-datos-nutria.json',
      url: 'blob:mis-datos',
    });
    const { result } = renderHook(() => useDescargarMisDatos(), { wrapper: envoltura });

    const clicks: HTMLAnchorElement[] = [];
    const clickOriginal = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this as HTMLAnchorElement);
    };

    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    HTMLAnchorElement.prototype.click = clickOriginal;

    expect(clicks[0]!.download).toBe('mis-datos-nutria.json');
    // Mantener vivo el objectURL dejaría el JSON con datos de salud en memoria
    // hasta cerrar la pestaña.
    expect(revocar).toHaveBeenCalledWith('blob:mis-datos');
    // Y el enlace no se queda colgado del documento.
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
