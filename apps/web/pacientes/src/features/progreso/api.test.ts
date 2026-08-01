import { ApiPacienteError } from '@/lib/apiCliente';

import { obtenerProgreso } from './api';

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function respuesta(cuerpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('obtenerProgreso', () => {
  it('lee el resumen sin mandar ningún identificador de paciente', async () => {
    // El `patientId` lo resuelve el servidor desde la sesión: si la app lo
    // enviara, existiría un parámetro que manipular para leer a otro paciente.
    fetchMock.mockResolvedValue(
      respuesta({ pesos: [], peso: null, falta_kg: null, logros: [] }),
    );

    await obtenerProgreso();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/progress', undefined);
  });

  it('propaga el error del servidor con su código', async () => {
    fetchMock.mockResolvedValue(
      respuesta({ error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403),
    );

    await expect(obtenerProgreso()).rejects.toThrow(ApiPacienteError);
  });

  it('no filtra el error nativo del navegador si la red falla', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(obtenerProgreso()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
