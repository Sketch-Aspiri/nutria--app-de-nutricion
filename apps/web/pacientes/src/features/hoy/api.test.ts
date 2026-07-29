/**
 * @jest-environment node
 */
import {
  borrarRegistroComida,
  estimarComida,
  guardarAgua,
  obtenerHoy,
  payloadDeEstimacion,
  preguntarCoach,
  registrarComida,
  registrarEjercicio,
  registrarFoto,
  registrarPeso,
  subirFoto,
} from './api';

const fetchMock = jest.fn();

function respuestaJson(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeAll(() => {
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
});

beforeEach(() => {
  fetchMock.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('API de Hoy', () => {
  it('obtiene el resumen diario', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ dia: '2026-07-29' }));

    await expect(obtenerHoy()).resolves.toMatchObject({ dia: '2026-07-29' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/today', undefined);
  });

  it('envía una comida como JSON', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ id: 'registro-1' }, 201));

    await registrarComida({ nombre: 'Ensalada', calorias: 250, origen: 'MANUAL' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/me/meal_logs',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Ensalada', calorias: 250, origen: 'MANUAL' }),
      }),
    );
  });

  it('acepta la respuesta vacía al borrar un registro', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(borrarRegistroComida('registro con espacio')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/me/meal_logs/registro%20con%20espacio', {
      method: 'DELETE',
    });
  });

  it('guarda agua y solicita una estimación', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ vasos: 5 }))
      .mockResolvedValueOnce(respuestaJson({ datos: { alimento: 'Tacos' } }));

    await guardarAgua('2026-07-29', 5);
    await estimarComida('dos tacos');

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ fecha: '2026-07-29', vasos: 5 }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ texto: 'dos tacos' }),
    });
  });

  it('sube la foto como multipart sin fijar Content-Type', async () => {
    fetchMock.mockResolvedValue(respuestaJson({ foto_url: 'https://blob.example/foto.jpg' }, 201));
    const archivo = new File([new Uint8Array([0xff, 0xd8])], 'comida.jpg', {
      type: 'image/jpeg',
    });

    await expect(subirFoto(archivo)).resolves.toBe('https://blob.example/foto.jpg');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('adjunta la URL subida al registro de comida', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ foto_url: 'https://blob.example/foto.jpg' }, 201))
      .mockResolvedValueOnce(respuestaJson({ id: 'registro-foto' }, 201));
    const archivo = new File([new Uint8Array([0xff, 0xd8])], 'comida.jpg', {
      type: 'image/jpeg',
    });

    await registrarFoto(archivo, 'Sopa de verduras');

    const segundoBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(segundoBody).toEqual({
      nombre: 'Sopa de verduras',
      foto_url: 'https://blob.example/foto.jpg',
      comentario_paciente: 'Sopa de verduras',
      origen: 'MANUAL',
    });
  });

  it('envía peso, ejercicio y coach con sus contratos snake_case', async () => {
    fetchMock
      .mockResolvedValueOnce(respuestaJson({ id: 'peso-1' }, 201))
      .mockResolvedValueOnce(respuestaJson({ id: 'ejercicio-1' }, 201))
      .mockResolvedValueOnce(respuestaJson({ texto: 'Respuesta' }));

    await registrarPeso('2026-07-29', 68.4);
    await registrarEjercicio('2026-07-29', 'Caminata', 30);
    await preguntarCoach('¿Puedo cambiar la cena?', [{ rol: 'coach', texto: '¿En qué te ayudo?' }]);

    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ fecha: '2026-07-29', peso_kg: 68.4 }),
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ fecha: '2026-07-29', tipo: 'Caminata', duracion_min: 30 }),
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).body).toContain('"rol":"coach"');
  });

  it('expone el código y mensaje seguro que devuelve la API', async () => {
    fetchMock.mockResolvedValue(
      respuestaJson(
        { error: { code: 'RATE_LIMITED', message: 'Espera un momento antes de reintentar.' } },
        429,
      ),
    );

    await expect(obtenerHoy()).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      message: 'Espera un momento antes de reintentar.',
    });
  });

  it('usa un mensaje de red seguro si el servidor no devuelve JSON', async () => {
    fetchMock.mockResolvedValue(new Response('gateway', { status: 502 }));

    await expect(obtenerHoy()).rejects.toThrow('Revisa tu conexión');
  });

  it('normaliza un rechazo real de fetch sin filtrar el error nativo', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch https://interno.example'));

    await expect(obtenerHoy()).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
      message: 'No pudimos completar la solicitud. Revisa tu conexión e intenta de nuevo.',
    });
  });
});

describe('payloadDeEstimacion', () => {
  it('marca como IA todos los nutrientes confirmados', () => {
    expect(
      payloadDeEstimacion({
        alimento: 'Tostadas',
        calorias: 360,
        proteina_g: 20,
        carbos_g: 42,
        grasa_g: 12,
      }),
    ).toEqual({
      nombre: 'Tostadas',
      calorias: 360,
      proteina_g: 20,
      carbos_g: 42,
      grasa_g: 12,
      origen: 'IA',
    });
  });
});
