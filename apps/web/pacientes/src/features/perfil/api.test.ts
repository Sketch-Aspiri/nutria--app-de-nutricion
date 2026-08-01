import { ApiPacienteError } from '@/lib/apiCliente';

import { cambiarPassword, darDeBaja, descargarMisDatos, obtenerPerfil } from './api';

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

describe('obtenerPerfil', () => {
  it('lee el perfil sin mandar identificadores', async () => {
    fetchMock.mockResolvedValue(respuesta({ id: 'p1', nombre: 'Camila' }));

    await obtenerPerfil();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me', undefined);
  });
});

describe('cambiarPassword', () => {
  it('manda las dos contraseñas al endpoint propio', async () => {
    fetchMock.mockResolvedValue(respuesta({ actualizada: true }));

    await cambiarPassword({ actual: 'vieja', nueva: 'nueva-larga-123' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/me/password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ actual: 'vieja', nueva: 'nueva-larga-123' });
  });

  it('propaga el rechazo del servidor con su código', async () => {
    fetchMock.mockResolvedValue(
      respuesta(
        { error: { code: 'VALIDATION_ERROR', message: 'Tu contraseña actual no es correcta.' } },
        400,
      ),
    );

    await expect(cambiarPassword({ actual: 'mala', nueva: 'nueva-larga-123' })).rejects.toThrow(
      ApiPacienteError,
    );
  });
});

describe('darDeBaja', () => {
  it('usa DELETE y manda la confirmación explícita', async () => {
    fetchMock.mockResolvedValue(respuesta({ baja: true }));

    await darDeBaja({ password: 'mi-contrasena', confirmacion: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/me/account');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ password: 'mi-contrasena', confirmacion: true });
  });
});

describe('descargarMisDatos', () => {
  const crearObjectURL = jest.fn(() => 'blob:mis-datos');

  beforeEach(() => {
    global.URL.createObjectURL = crearObjectURL as unknown as typeof URL.createObjectURL;
  });

  it('devuelve el archivo como blob con nombre propio', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['{}'], { type: 'application/json' }),
    } as Response);

    const archivo = await descargarMisDatos();

    expect(archivo).toEqual({ nombreArchivo: 'mis-datos-nutria.json', url: 'blob:mis-datos' });
  });

  it('lee el error del servidor en vez de bajar un archivo con el error adentro', async () => {
    // Con un `<a download>` apuntando al endpoint, un 429 se descargaría como
    // un JSON de error llamado "mis-datos".
    fetchMock.mockResolvedValue(
      respuesta({ error: { code: 'RATE_LIMITED', message: 'Ya descargaste hace poco.' } }, 429),
    );

    await expect(descargarMisDatos()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
  });

  it('da un mensaje utilizable si el error no trae cuerpo', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('sin cuerpo');
      },
    } as unknown as Response);

    await expect(descargarMisDatos()).rejects.toMatchObject({ code: 'EXPORT_FAILED' });
  });

  it('no filtra el error nativo del navegador si la red falla', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(descargarMisDatos()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
