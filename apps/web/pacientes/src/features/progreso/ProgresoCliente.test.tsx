import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as api from './api';
import { ProgresoCliente } from './ProgresoCliente';
import type { Progreso } from './types';

jest.mock('./api', () => ({
  obtenerProgreso: jest.fn(),
}));

const obtenerProgreso = api.obtenerProgreso as jest.MockedFunction<typeof api.obtenerProgreso>;

function progreso(parcial: Partial<Progreso> = {}): Progreso {
  return { pesos: [], peso: null, falta_kg: null, logros: [], ...parcial };
}

function renderProgreso() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProgresoCliente />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProgresoCliente', () => {
  it('arma la pantalla con una sola lectura: tarjetas, gráfica y logros', async () => {
    obtenerProgreso.mockResolvedValue(
      progreso({
        pesos: [
          { id: 'p1', fecha: '2026-07-01', peso_kg: 78, created_at: '2026-07-01T12:00:00.000Z' },
          { id: 'p2', fecha: '2026-07-15', peso_kg: 75, created_at: '2026-07-15T12:00:00.000Z' },
        ],
        peso: { inicial: 78, actual: 75, cambio_kg: -3 },
        logros: [
          {
            id: 'racha_dias',
            titulo: 'Racha de 7 días',
            descripcion: 'Registra tus comidas 7 días seguidos.',
            conseguido: true,
            progreso: 1,
          },
        ],
      }),
    );
    renderProgreso();

    expect(await screen.findByText('Perdido')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/Evolución de tu peso/);
    expect(screen.getByText('Racha de 7 días')).toBeInTheDocument();
  });

  it('sigue mostrando los logros aunque el paciente no se haya pesado nunca', async () => {
    // La racha y la meta de agua avanzan con comidas y vasos: no dependen de
    // la báscula, así que la pantalla no puede quedarse en blanco por eso.
    obtenerProgreso.mockResolvedValue(
      progreso({
        logros: [
          {
            id: 'agua_meta',
            titulo: 'Hidratación constante',
            descripcion: 'Alcanza tu meta de agua 7 días.',
            conseguido: false,
            progreso: 0.28,
          },
        ],
      }),
    );
    renderProgreso();

    expect(await screen.findByText('Hidratación constante')).toBeInTheDocument();
    expect(
      screen.getByText('Registra tu peso al menos dos veces para ver tu tendencia.'),
    ).toBeInTheDocument();
  });

  it('avisa que solo hay un pesaje en vez de dejar el hueco sin explicación', async () => {
    obtenerProgreso.mockResolvedValue(
      progreso({
        pesos: [
          { id: 'p1', fecha: '2026-07-01', peso_kg: 78, created_at: '2026-07-01T12:00:00.000Z' },
        ],
        peso: { inicial: 78, actual: 78, cambio_kg: 0 },
      }),
    );
    renderProgreso();

    expect(await screen.findByText('Llevas 1 pesaje registrado.')).toBeInTheDocument();
  });

  it('ofrece reintentar si la lectura falla, y el reintento vuelve a pedir', async () => {
    obtenerProgreso.mockRejectedValueOnce(new Error('sin conexión'));
    renderProgreso();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu progreso');

    obtenerProgreso.mockResolvedValueOnce(progreso());
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));

    await waitFor(() => expect(obtenerProgreso).toHaveBeenCalledTimes(2));
  });

  it('no muestra cifras mientras carga', async () => {
    obtenerProgreso.mockReturnValue(new Promise(() => {}));
    renderProgreso();

    expect(await screen.findByLabelText('Cargando tu progreso')).toBeInTheDocument();
    expect(screen.queryByText('Tus logros')).not.toBeInTheDocument();
  });
});
