import { generarJSON, generarTexto } from './ia';

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('generarTexto', () => {
  it('devuelve el texto cuando el endpoint responde bien', async () => {
    mockFetch(200, { text: 'hola' });
    await expect(generarTexto('prompt')).resolves.toBe('hola');
  });

  it('envía el prompt y max_tokens al endpoint interno', async () => {
    mockFetch(200, { text: 'ok' });
    await generarTexto('mi prompt', 500);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: 'mi prompt', max_tokens: 500 }),
      }),
    );
  });

  it('lanza el mensaje de error del backend cuando la respuesta falla', async () => {
    mockFetch(503, { error: { code: 'AI_NOT_CONFIGURED', message: 'IA no configurada' } });
    await expect(generarTexto('prompt')).rejects.toThrow('IA no configurada');
  });

  it('lanza un mensaje genérico si el cuerpo de error no tiene el formato esperado', async () => {
    mockFetch(500, {});
    await expect(generarTexto('prompt')).rejects.toThrow('Error del servicio de IA');
  });
});

describe('generarJSON', () => {
  it('parsea la respuesta JSON aunque venga con fences de markdown', async () => {
    mockFetch(200, { text: '```json\n{"calorias": 1800}\n```' });
    await expect(generarJSON<{ calorias: number }>('prompt')).resolves.toEqual({ calorias: 1800 });
  });

  it('lanza SyntaxError si la IA no devuelve JSON', async () => {
    mockFetch(200, { text: 'no soy json' });
    await expect(generarJSON('prompt')).rejects.toThrow(SyntaxError);
  });
});
