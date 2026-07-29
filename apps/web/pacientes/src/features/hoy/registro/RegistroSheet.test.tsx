import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as api from '../api';
import { RegistroSheet } from './RegistroSheet';

jest.mock('../api', () => ({
  estimarComida: jest.fn(),
  registrarComida: jest.fn(),
  registrarFoto: jest.fn(),
  registrarPeso: jest.fn(),
  registrarEjercicio: jest.fn(),
  payloadDeEstimacion: jest.requireActual('../api').payloadDeEstimacion,
}));

const estimarComida = api.estimarComida as jest.MockedFunction<typeof api.estimarComida>;
const registrarComida = api.registrarComida as jest.MockedFunction<typeof api.registrarComida>;
const registrarPeso = api.registrarPeso as jest.MockedFunction<typeof api.registrarPeso>;

function renderSheet(onSuccess = jest.fn(), dia: string | null = '2026-07-29') {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RegistroSheet
        dia={dia}
        cargandoDia={dia === null}
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegistroSheet', () => {
  it('ofrece los cuatro registros funcionales', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: /una comida/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^peso/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ejercicio/i })).toBeInTheDocument();
  });

  it('no permite fechar peso o ejercicio con la hora local del navegador', () => {
    renderSheet(jest.fn(), null);

    expect(screen.getByRole('button', { name: /^peso/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^ejercicio/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('fecha de tu consultorio');
  });

  it('estima una comida y solo la guarda después de la confirmación', async () => {
    estimarComida.mockResolvedValue({
      tipo: 'ESTIMACION_COMIDA',
      formato: 'estructurado',
      datos: {
        alimento: 'Dos tacos de pollo',
        calorias: 420,
        proteina_g: 28,
        carbos_g: 42,
        grasa_g: 14,
      },
      aviso: 'Estimación orientativa.',
      cuota: { usadas: 1, limite: 20, restantes: 19 },
    });
    registrarComida.mockResolvedValue({} as Awaited<ReturnType<typeof api.registrarComida>>);
    const { onSuccess } = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: /una comida/i }));
    fireEvent.change(screen.getByLabelText(/describe qué comiste/i), {
      target: { value: 'dos tacos de pollo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /estimar con ia/i }));

    expect(await screen.findByText('420 kcal')).toBeInTheDocument();
    expect(registrarComida).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /agregar a mi día/i }));
    await waitFor(() =>
      expect(registrarComida).toHaveBeenCalledWith({
        nombre: 'Dos tacos de pollo',
        calorias: 420,
        proteina_g: 28,
        carbos_g: 42,
        grasa_g: 14,
        origen: 'IA',
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith('Comida agregada a tu día.');
  });

  it('registra el peso con el día que entrega el servidor', async () => {
    registrarPeso.mockResolvedValue({});
    const { onSuccess } = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: /^peso/i }));
    fireEvent.change(screen.getByLabelText(/tu peso de hoy/i), { target: { value: '68.4' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar peso/i }));

    await waitFor(() => expect(registrarPeso).toHaveBeenCalledWith('2026-07-29', 68.4));
    expect(onSuccess).toHaveBeenCalledWith('Peso actualizado.');
  });
});
