import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import * as api from './api';
import { ListaRecetas } from './ListaRecetas';
import type { Receta } from './types';

jest.mock('./api', () => ({
  obtenerRecetas: jest.fn(),
}));

const obtenerRecetas = api.obtenerRecetas as jest.MockedFunction<typeof api.obtenerRecetas>;

function receta(parcial: Partial<Receta>): Receta {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Avena con fruta',
    ingredientes: ['1 taza de avena', '1 plátano'],
    pasos: null,
    calorias: 400,
    porciones: 2,
    origen: 'MANUAL',
    updated_at: '2026-07-30T12:00:00.000Z',
    ...parcial,
  };
}

function renderLista() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ListaRecetas />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ListaRecetas', () => {
  it('enlaza cada receta a su detalle con kcal por porción', async () => {
    obtenerRecetas.mockResolvedValue([receta({})]);
    renderLista();

    const enlace = await screen.findByRole('link', { name: /Avena con fruta/ });
    expect(enlace).toHaveAttribute('href', '/plan/recetas/11111111-1111-4111-8111-111111111111');
    expect(enlace).toHaveTextContent('200 kcal por porción');
    expect(enlace).toHaveTextContent('2 ingredientes');
  });

  it('marca las recetas propuestas con IA', async () => {
    obtenerRecetas.mockResolvedValue([receta({ origen: 'IA' })]);
    renderLista();

    expect(await screen.findByText('IA')).toBeInTheDocument();
  });

  it('omite las kcal cuando la receta no las trae, sin escribir un cero', async () => {
    obtenerRecetas.mockResolvedValue([receta({ calorias: null })]);
    renderLista();

    const enlace = await screen.findByRole('link', { name: /Avena con fruta/ });
    expect(enlace).not.toHaveTextContent('kcal');
  });

  it('singulariza el conteo de un solo ingrediente', async () => {
    obtenerRecetas.mockResolvedValue([receta({ ingredientes: ['Sal'] })]);
    renderLista();

    expect(await screen.findByText('1 ingrediente')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la nutrióloga no ha enviado ninguna', async () => {
    obtenerRecetas.mockResolvedValue([]);
    renderLista();

    expect(await screen.findByText('Todavía no tienes recetas')).toBeInTheDocument();
  });

  it('ofrece reintentar si la lectura falla', async () => {
    obtenerRecetas.mockRejectedValue(new Error('sin conexión'));
    renderLista();

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus recetas');
  });
});
