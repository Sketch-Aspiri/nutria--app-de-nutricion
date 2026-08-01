import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import * as api from './api';
import { ComidasDelPlan } from './ComidasDelPlan';
import type { PlanPaciente } from './types';

jest.mock('./api', () => ({
  obtenerPlan: jest.fn(),
}));

const obtenerPlan = api.obtenerPlan as jest.MockedFunction<typeof api.obtenerPlan>;

const PLAN: PlanPaciente = {
  id: 'plan-1',
  estado: 'ACTIVO',
  calorias_diarias: 1800,
  proteina_g: 120,
  carbos_g: 180,
  grasa_g: 60,
  nota: 'Toma agua entre comidas.',
  compartido_at: '2026-07-30T12:00:00.000Z',
  pdf_url: null,
  updated_at: '2026-07-30T12:00:00.000Z',
  comidas: [
    {
      id: 'comida-1',
      orden: 1,
      nombre: 'Desayuno',
      horario: '08:00',
      descripcion: null,
      items: [
        {
          id: 'item-1',
          descripcion_libre: null,
          cantidad_porciones: 1.5,
          energia_kcal: 300.4,
          proteina_g: 20,
          carbohidratos_g: 35,
          lipidos_g: 8,
          food: { nombre: 'Avena', porcion_descripcion: '1 taza' },
        },
      ],
    },
  ],
};

function renderComidas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComidasDelPlan />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ComidasDelPlan', () => {
  it('muestra metas, nota, porciones y kcal de la comida', async () => {
    obtenerPlan.mockResolvedValue(PLAN);
    renderComidas();

    expect(await screen.findByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Avena — 1.5 × 1 taza')).toBeInTheDocument();
    expect(screen.getByText('300 kcal')).toBeInTheDocument();
    expect(screen.getByText('Toma agua entre comidas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Metas diarias de tu plan')).toHaveTextContent('1800');
  });

  it('no dibuja una semana: el modelo guarda un plan diario', async () => {
    obtenerPlan.mockResolvedValue(PLAN);
    renderComidas();
    await screen.findByText('Desayuno');

    // El prototipo pintaba L·M·M·J·V·S·D con un día resaltado y sin contenido
    // propio. §12 deja la vista semanal fuera de la V1.
    expect(screen.queryByText('L')).not.toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('explica que no hay plan en vez de mostrar metas en cero', async () => {
    obtenerPlan.mockResolvedValue(null);
    renderComidas();

    expect(await screen.findByText('Tu nutrióloga aún no comparte tu plan')).toBeInTheDocument();
    expect(screen.queryByLabelText('Metas diarias de tu plan')).not.toBeInTheDocument();
  });

  it('ofrece reintentar si la lectura falla, sin inventar cifras', async () => {
    obtenerPlan.mockRejectedValue(new Error('sin conexión'));
    renderComidas();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu plan');
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
