import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ActividadCompartida } from './ActividadCompartida';
import * as api from './api';

jest.mock('./api', () => ({
  obtenerPlanActividad: jest.fn(),
}));

const obtenerPlanActividad = api.obtenerPlanActividad as jest.MockedFunction<
  typeof api.obtenerPlanActividad
>;

function renderActividad() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActividadCompartida />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ActividadCompartida', () => {
  it('respeta el texto tal como lo escribió la nutrióloga', async () => {
    obtenerPlanActividad.mockResolvedValue({
      id: 'actividad-1',
      texto: 'Lunes: caminata 30 min\nMiércoles: fuerza 40 min',
      compartido_at: '2026-07-30T12:00:00.000Z',
      updated_at: '2026-07-30T12:00:00.000Z',
    });
    renderActividad();

    // Un solo nodo con los saltos de línea intactos: no se reinterpreta como
    // una rutina estructurada que nadie capturó.
    expect(
      await screen.findByText(/Lunes: caminata 30 min\s+Miércoles: fuerza 40 min/),
    ).toBeInTheDocument();
  });

  it('dice que no hay plan de actividad en vez de dejar la pestaña vacía', async () => {
    obtenerPlanActividad.mockResolvedValue(null);
    renderActividad();

    expect(await screen.findByText('No tienes un plan de actividad')).toBeInTheDocument();
  });

  it('ofrece reintentar si la lectura falla', async () => {
    obtenerPlanActividad.mockRejectedValue(new Error('sin conexión'));
    renderActividad();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tu plan de actividad',
    );
  });
});
