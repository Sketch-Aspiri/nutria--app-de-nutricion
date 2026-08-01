import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { PROGRESO_QUERY_KEY } from '@/features/progreso/useProgreso';

import * as api from './api';
import { HOY_QUERY_KEY } from './useHoy';
import { useRegistrarComida, useRegistrarEjercicio, useRegistrarPeso } from './useRegistro';

jest.mock('./api', () => ({
  estimarComida: jest.fn(),
  payloadDeEstimacion: jest.fn((estimacion: unknown) => estimacion),
  preguntarCoach: jest.fn(),
  registrarComida: jest.fn(),
  registrarEjercicio: jest.fn(),
  registrarFoto: jest.fn(),
  registrarPeso: jest.fn(),
}));

const registrarComida = api.registrarComida as jest.MockedFunction<typeof api.registrarComida>;
const registrarEjercicio = api.registrarEjercicio as jest.MockedFunction<
  typeof api.registrarEjercicio
>;
const registrarPeso = api.registrarPeso as jest.MockedFunction<typeof api.registrarPeso>;

/**
 * Qué se invalida al registrar.
 *
 * Los logros de Progreso se calculan desde los mismos registros que alimentan
 * Hoy, así que registrar tiene que ensuciar las dos cachés. Sin esto el
 * paciente registra su cena, entra a Progreso y ve la racha de ayer durante los
 * cinco minutos que dura `staleTime`.
 */
function montar<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidadas: unknown[] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  jest.spyOn(queryClient, 'invalidateQueries').mockImplementation((filtros) => {
    invalidadas.push(filtros?.queryKey);
    return original(filtros);
  });

  const { result } = renderHook(hook, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { result, invalidadas };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRegistrarComida', () => {
  it('refresca Hoy y también Progreso: la racha se calcula con estas comidas', async () => {
    registrarComida.mockResolvedValue({} as Awaited<ReturnType<typeof api.registrarComida>>);
    const { result, invalidadas } = montar(() => useRegistrarComida());

    await act(async () => {
      result.current.mutate({
        alimento: 'Ensalada',
        calorias: 320,
        proteina_g: 12,
        carbos_g: 30,
        grasa_g: 14,
      } as never);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidadas).toContainEqual(HOY_QUERY_KEY);
    expect(invalidadas).toContainEqual(PROGRESO_QUERY_KEY);
  });
});

describe('useRegistrarEjercicio', () => {
  it('refresca Progreso: el ejercicio alimenta el logro de días activo', async () => {
    registrarEjercicio.mockResolvedValue({});
    const { result, invalidadas } = montar(() => useRegistrarEjercicio());

    await act(async () => {
      result.current.mutate({ fecha: '2026-07-31', tipo: 'Caminata', duracionMin: 30 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidadas).toContainEqual(PROGRESO_QUERY_KEY);
  });
});

describe('useRegistrarPeso', () => {
  it('refresca Progreso para que la gráfica muestre el pesaje recién guardado', async () => {
    registrarPeso.mockResolvedValue({});
    const { result, invalidadas } = montar(() => useRegistrarPeso());

    await act(async () => {
      result.current.mutate({ fecha: '2026-07-31', pesoKg: 74.5 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidadas).toContainEqual(PROGRESO_QUERY_KEY);
  });
});
