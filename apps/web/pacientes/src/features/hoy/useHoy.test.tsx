import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import * as api from './api';
import type { ComidaPlanHoy, ResumenHoy } from './types';
import { HOY_QUERY_KEY, useToggleComida } from './useHoy';

jest.mock('./api', () => ({
  borrarRegistroComida: jest.fn(),
  guardarAgua: jest.fn(),
  obtenerHoy: jest.fn(),
  registrarComida: jest.fn(),
}));

const registrarComida = api.registrarComida as jest.MockedFunction<typeof api.registrarComida>;

const COMIDA: ComidaPlanHoy = {
  id: 'comida-1',
  orden: 1,
  nombre: 'Colación',
  horario: '11:00',
  descripcion: 'Yogur con fruta',
  items: [
    {
      id: 'item-1',
      descripcion_libre: null,
      energia_kcal: 82.5,
      proteina_g: 7.25,
      carbohidratos_g: 9.5,
      lipidos_g: 2,
      food: { nombre: 'Yogur', porcion_descripcion: 'Media taza' },
    },
  ],
};

const RESUMEN: ResumenHoy = {
  dia: '2026-07-29',
  zona_horaria: 'America/Cancun',
  plan: {
    id: 'plan-1',
    calorias_diarias: 1600,
    proteina_g: 100,
    carbos_g: 160,
    grasa_g: 50,
    comidas: [COMIDA],
  },
  comidas_marcadas: [],
  registros: [],
  agua: { vasos: 3, meta: 8 },
  adherencia: {
    porcentaje: 25,
    racha: 2,
    dias_evaluados: 2,
    comidas_registradas: 1,
    comidas_esperadas: 4,
  },
};

function preparar() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(HOY_QUERY_KEY, RESUMEN);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useToggleComida(), { wrapper }) };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useToggleComida', () => {
  it('restaura toda la caché si el POST falla después de onMutate', async () => {
    let rechazar: ((motivo: Error) => void) | undefined;
    registrarComida.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rechazar = reject;
        }),
    );
    const { queryClient, result } = preparar();

    act(() => {
      result.current.mutate({ comida: COMIDA, marcada: false, registroIds: [] });
    });
    await waitFor(() =>
      expect(queryClient.getQueryData<ResumenHoy>(HOY_QUERY_KEY)?.comidas_marcadas).toEqual([
        'comida-1',
      ]),
    );

    act(() => rechazar?.(new Error('rechazo del servidor')));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(HOY_QUERY_KEY)).toEqual(RESUMEN);
  });

  it('redondea kcal fraccionarias antes de enviarlas al esquema de meal_logs', async () => {
    registrarComida.mockResolvedValue({} as Awaited<ReturnType<typeof api.registrarComida>>);
    const { result } = preparar();

    await act(async () => {
      await result.current.mutateAsync({
        comida: COMIDA,
        marcada: false,
        registroIds: [],
      });
    });

    expect(registrarComida).toHaveBeenCalledWith({
      meal_plan_meal_id: 'comida-1',
      nombre: 'Colación',
      calorias: 83,
      proteina_g: 7.25,
      carbos_g: 9.5,
      grasa_g: 2,
      origen: 'MANUAL',
    });
  });
});
