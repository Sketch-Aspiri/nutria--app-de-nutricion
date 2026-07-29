import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as api from '../api';
import type { ResumenHoy } from '../types';
import { HOY_QUERY_KEY } from '../useHoy';
import { RegistroProvider, useAbrirRegistro } from './RegistroProvider';

jest.mock('../api', () => ({
  borrarRegistroComida: jest.fn(),
  guardarAgua: jest.fn(),
  obtenerHoy: jest.fn(),
  registrarComida: jest.fn(),
  estimarComida: jest.fn(),
  payloadDeEstimacion: jest.requireActual('../api').payloadDeEstimacion,
  preguntarCoach: jest.fn(),
  registrarEjercicio: jest.fn(),
  registrarFoto: jest.fn(),
  registrarPeso: jest.fn(),
}));

const obtenerHoy = api.obtenerHoy as jest.MockedFunction<typeof api.obtenerHoy>;

const AYER: ResumenHoy = {
  dia: '2026-07-28',
  zona_horaria: 'America/Cancun',
  plan: null,
  comidas_marcadas: [],
  registros: [],
  agua: { vasos: 0, meta: 8 },
  adherencia: null,
};

function Abrir() {
  const abrir = useAbrirRegistro();
  return (
    <button type="button" onClick={abrir}>
      Registrar
    </button>
  );
}

describe('RegistroProvider', () => {
  it('no reutiliza la fecha cacheada de ayer si falla su revalidación', async () => {
    obtenerHoy.mockRejectedValue(new Error('sin conexión'));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(HOY_QUERY_KEY, AYER);

    render(
      <QueryClientProvider client={queryClient}>
        <RegistroProvider>
          <Abrir />
        </RegistroProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(screen.getByText(/no pudimos verificar la fecha clínica/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^peso/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^ejercicio/i })).toBeDisabled();
  });
});
