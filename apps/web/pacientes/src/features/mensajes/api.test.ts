import { ApiPacienteError } from '@/lib/apiCliente';

import { enviarMensaje, marcarLeidos, obtenerMensajes } from './api';

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

describe('obtenerMensajes', () => {
  it('conserva el sobre completo, no solo `data`', async () => {
    // `sin_leer` viaja en el `meta` y es lo que alimenta el indicador de la
    // nav: `pedirLista` lo tiraría.
    fetchMock.mockResolvedValue(
      respuesta({ data: [], meta: { page: 1, per_page: 0, total: 0, sin_leer: 4 } }),
    );

    const sobre = await obtenerMensajes();

    expect(sobre.meta.sin_leer).toBe(4);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/messages', undefined);
  });
});

describe('enviarMensaje', () => {
  it('manda solo el texto: el destinatario lo resuelve el servidor', async () => {
    // Si el nutriólogo viajara en el cuerpo, existiría un campo que manipular
    // para escribirle a cualquier profesional de la plataforma.
    fetchMock.mockResolvedValue(respuesta({ id: 'm1' }, 201));

    await enviarMensaje('Hola');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/me/messages');
    expect(JSON.parse(init.body)).toEqual({ texto: 'Hola' });
  });

  it('propaga la validación del servidor con su código', async () => {
    fetchMock.mockResolvedValue(
      respuesta({ error: { code: 'VALIDATION_ERROR', message: 'Escribe un mensaje.' } }, 422),
    );

    await expect(enviarMensaje('')).rejects.toThrow(ApiPacienteError);
  });

  it('no filtra el error nativo del navegador si la red falla', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(enviarMensaje('Hola')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('marcarLeidos', () => {
  it('acusa la lectura sin enviar identificadores', async () => {
    fetchMock.mockResolvedValue(respuesta({ marcados: 2 }));

    expect(await marcarLeidos()).toEqual({ marcados: 2 });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/me/messages/read');
  });
});
