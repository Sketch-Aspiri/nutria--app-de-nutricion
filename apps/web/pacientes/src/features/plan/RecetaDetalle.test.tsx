import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as api from './api';
import { RecetaDetalle } from './RecetaDetalle';
import type { Receta, RespuestaSustitucion } from './types';

jest.mock('./api', () => ({
  obtenerRecetas: jest.fn(),
  sustituirIngrediente: jest.fn(),
}));

const obtenerRecetas = api.obtenerRecetas as jest.MockedFunction<typeof api.obtenerRecetas>;
const sustituir = api.sustituirIngrediente as jest.MockedFunction<typeof api.sustituirIngrediente>;

const RECETA_ID = '11111111-1111-4111-8111-111111111111';

const RECETA: Receta = {
  id: RECETA_ID,
  nombre: 'Avena con fruta',
  ingredientes: ['1 taza de avena', '1 plátano'],
  pasos: '1. Calienta el agua\n2. Agrega la avena',
  calorias: 400,
  porciones: 2,
  origen: 'MANUAL',
  updated_at: '2026-07-30T12:00:00.000Z',
};

const SUGERENCIA: RespuestaSustitucion = {
  tipo: 'SUSTITUCION_INGREDIENTE',
  formato: 'estructurado',
  datos: { sustituto: '2 cdas de tahini', razon: 'Aporta grasa y proteína parecidas.' },
  aviso: 'Sugerencia generada con IA; consúltalo con tu nutrióloga.',
  cuota: { limite: 30, usadas: 4, restantes: 26, agotada: false },
};

function renderDetalle(recetaId = RECETA_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecetaDetalle recetaId={recetaId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  obtenerRecetas.mockResolvedValue([RECETA]);
});

describe('RecetaDetalle', () => {
  it('muestra ingredientes, pasos renumerados y kcal por porción', async () => {
    renderDetalle();

    expect(await screen.findByText('1 taza de avena')).toBeInTheDocument();
    expect(screen.getByText('Calienta el agua')).toBeInTheDocument();
    // El "1." lo pinta la lista; el del texto original se quitó al normalizar.
    expect(screen.queryByText('1. Calienta el agua')).not.toBeInTheDocument();
    expect(screen.getByText('200 kcal por porción')).toBeInTheDocument();
  });

  it('no filtra una receta ajena: un id que el listado no trae no existe', async () => {
    renderDetalle('99999999-9999-4999-8999-999999999999');

    expect(await screen.findByText('Esta receta ya no está disponible')).toBeInTheDocument();
    expect(screen.queryByText('1 taza de avena')).not.toBeInTheDocument();
  });

  it('pide la sustitución con el id de la receta y muestra aviso y cuota', async () => {
    sustituir.mockResolvedValue(SUGERENCIA);
    renderDetalle();
    await screen.findByText('1 taza de avena');

    fireEvent.change(screen.getByLabelText('Ingrediente que quieres cambiar'), {
      target: { value: '  crema de cacahuate  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sustituir' }));

    await waitFor(() => expect(screen.getByText('2 cdas de tahini')).toBeInTheDocument());
    expect(sustituir).toHaveBeenCalledWith({
      ingrediente: 'crema de cacahuate',
      receta_id: RECETA_ID,
    });
    expect(screen.getByText(SUGERENCIA.aviso)).toBeInTheDocument();
    expect(screen.getByText('Te quedan 26 de 30 consultas este mes.')).toBeInTheDocument();
  });

  it('no envía nada si el ingrediente es demasiado corto para el esquema', async () => {
    renderDetalle();
    await screen.findByText('1 taza de avena');

    fireEvent.change(screen.getByLabelText('Ingrediente que quieres cambiar'), {
      target: { value: 'a' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sustituir' }));

    expect(sustituir).not.toHaveBeenCalled();
  });

  it('muestra el mensaje del servidor cuando la sustitución se rechaza', async () => {
    sustituir.mockRejectedValue(
      new Error('No encontré un sustituto que respete tus alergias. Pregúntale a tu nutrióloga.'),
    );
    renderDetalle();
    await screen.findByText('1 taza de avena');

    fireEvent.change(screen.getByLabelText('Ingrediente que quieres cambiar'), {
      target: { value: 'cacahuate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sustituir' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('respete tus alergias');
  });
});
