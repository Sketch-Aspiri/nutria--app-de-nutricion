import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

import * as api from '@/features/mensajes/api';

import { BottomNav, textoDelIndicador } from './BottomNav';

jest.mock('@/features/mensajes/api', () => ({
  obtenerMensajes: jest.fn(),
  enviarMensaje: jest.fn(),
  marcarLeidos: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

jest.mock('@/features/hoy/registro/RegistroProvider', () => ({
  useAbrirRegistro: () => jest.fn(),
}));

const obtenerMensajes = api.obtenerMensajes as jest.MockedFunction<typeof api.obtenerMensajes>;

function sobre(sinLeer: number) {
  return { data: [], meta: { page: 1, per_page: 0, total: 0, sin_leer: sinLeer } };
}

function renderNav() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BottomNav />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('textoDelIndicador', () => {
  it('corta en 9+ para que el globo no deforme la pestaña', () => {
    expect(textoDelIndicador(3)).toBe('3');
    expect(textoDelIndicador(9)).toBe('9');
    expect(textoDelIndicador(10)).toBe('9+');
    expect(textoDelIndicador(148)).toBe('9+');
  });
});

describe('indicador de no leídos', () => {
  it('anuncia los mensajes sin leer con palabras, no solo con un globo', async () => {
    obtenerMensajes.mockResolvedValue(sobre(3));
    renderNav();

    expect(await screen.findByText('3 mensajes sin leer')).toBeInTheDocument();
  });

  it('usa el singular con un solo mensaje', async () => {
    obtenerMensajes.mockResolvedValue(sobre(1));
    renderNav();

    expect(await screen.findByText('1 mensaje sin leer')).toBeInTheDocument();
  });

  it('no pinta nada cuando no hay pendientes', async () => {
    obtenerMensajes.mockResolvedValue(sobre(0));
    renderNav();

    await waitFor(() => expect(obtenerMensajes).toHaveBeenCalled());
    expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument();
  });

  it('no inventa un cero si la lectura falla', async () => {
    // Un fallo de red no debe pintar un globo ni tumbar la navegación: sin
    // dato, no hay indicador.
    obtenerMensajes.mockRejectedValue(new Error('sin conexión'));
    renderNav();

    await waitFor(() => expect(obtenerMensajes).toHaveBeenCalled());
    expect(screen.queryByText(/sin leer/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mensajes/ })).toBeInTheDocument();
  });
});
