/**
 * @jest-environment node
 */
import { IaUpstreamError } from '@/server/ai/cliente';
import {
  CuotaAgotadaError,
  PacienteNoEncontradoError,
  generarContenido,
} from '@/server/ai/servicio';
import { requiereNutriologo } from '@/server/auth/guards';
import { unauthenticated } from '@/server/http';

import { POST } from './route';

jest.mock('@/server/auth/guards', () => ({ requiereNutriologo: jest.fn() }));
jest.mock('@/server/ai/servicio', () => {
  const real = jest.requireActual('@/server/ai/servicio');
  return { ...real, generarContenido: jest.fn() };
});

const mockGuard = requiereNutriologo as jest.Mock;
const mockGenerar = generarContenido as jest.Mock;

const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const PATIENT_ID = 'b1b2c3d4-0000-4000-8000-000000000002';
const CUOTA = {
  plan: 'FREE' as const,
  limite: 15,
  usadas: 15,
  restantes: 0,
  agotada: true,
  ilimitada: false,
};

function peticion(cuerpo: unknown): Request {
  return new Request('http://localhost/api/v1/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

/** Lee un cuerpo SSE completo y devuelve los pares evento/dato. */
async function leerSse(respuesta: Response): Promise<Array<{ evento: string; datos: unknown }>> {
  const texto = await respuesta.text();
  return texto
    .split('\n\n')
    .filter((bloque) => bloque.trim())
    .map((bloque) => {
      const evento = bloque.match(/^event: (.+)$/m)?.[1] ?? '';
      const datos = bloque.match(/^data: (.+)$/m)?.[1] ?? 'null';
      return { evento, datos: JSON.parse(datos) as unknown };
    });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'sk-ant-de-prueba';
  mockGuard.mockResolvedValue({ ok: true, sesion: {}, userId: USER_ID });
});

describe('POST /api/v1/ai/generate — guardas', () => {
  it('rechaza sin sesión antes de tocar el servicio', async () => {
    mockGuard.mockResolvedValue({ ok: false, respuesta: unauthenticated() });

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));

    expect(respuesta.status).toBe(401);
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('responde 503 cuando falta la API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));
    const cuerpo = (await respuesta.json()) as { error: { code: string } };

    expect(respuesta.status).toBe(503);
    expect(cuerpo.error.code).toBe('AI_NOT_CONFIGURED');
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de generación desconocido', async () => {
    const respuesta = await POST(peticion({ tipo: 'INVENTADO', patient_id: PATIENT_ID }));

    expect(respuesta.status).toBe(400);
    expect(mockGenerar).not.toHaveBeenCalled();
  });

  it('rechaza un identificador de paciente que no es UUID', async () => {
    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: 'abc' }));

    expect(respuesta.status).toBe(400);
  });

  it('rechaza un cuerpo que no es JSON válido', async () => {
    const rota = new Request('http://localhost/api/v1/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ roto',
    });

    const respuesta = await POST(rota);
    const cuerpo = (await respuesta.json()) as { error: { code: string } };

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe('INVALID_BODY');
  });
});

describe('POST /api/v1/ai/generate — errores del servicio', () => {
  it('traduce la cuota agotada a 429 AI_LIMIT_REACHED con CTA de plan', async () => {
    mockGenerar.mockRejectedValue(new CuotaAgotadaError(CUOTA));

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));
    const cuerpo = (await respuesta.json()) as { error: { code: string; message: string } };

    expect(respuesta.status).toBe(429);
    expect(cuerpo.error.code).toBe('AI_LIMIT_REACHED');
    expect(cuerpo.error.message).toContain('15');
    expect(cuerpo.error.message).toContain('Mejora tu plan');
  });

  it('devuelve 404 cuando el paciente es de otro nutriólogo', async () => {
    mockGenerar.mockRejectedValue(new PacienteNoEncontradoError());

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));

    expect(respuesta.status).toBe(404);
  });

  it('traduce una falla del proveedor a 502 sin filtrar detalles', async () => {
    mockGenerar.mockRejectedValue(new IaUpstreamError(529));

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));
    const cuerpo = (await respuesta.json()) as { error: { code: string; message: string } };

    expect(respuesta.status).toBe(502);
    expect(cuerpo.error.code).toBe('AI_UPSTREAM_ERROR');
    expect(cuerpo.error.message).not.toContain('529');
  });

  it('distingue la saturación del proveedor en el mensaje', async () => {
    mockGenerar.mockRejectedValue(new IaUpstreamError(429));

    const respuesta = await POST(peticion({ tipo: 'PLAN', patient_id: PATIENT_ID }));
    const cuerpo = (await respuesta.json()) as { error: { message: string } };

    expect(cuerpo.error.message).toContain('saturado');
  });
});

describe('POST /api/v1/ai/generate — respuesta correcta', () => {
  const salida = {
    tipo: 'PLAN',
    formato: 'estructurado',
    datos: { calorias_diarias: 2_000 },
    texto: null,
    advertencias: [],
    cuota: { ...CUOTA, usadas: 1, restantes: 14, agotada: false },
  };

  it('devuelve el borrador y pasa la petición validada al servicio', async () => {
    mockGenerar.mockResolvedValue(salida);

    const respuesta = await POST(
      peticion({ tipo: 'PLAN', patient_id: PATIENT_ID, notas: 'más fibra' }),
    );

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual(salida);
    expect(mockGenerar).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ tipo: 'PLAN', patient_id: PATIENT_ID, notas: 'más fibra' }),
    );
  });

  it('acepta una sugerencia de respuesta a un mensaje', async () => {
    mockGenerar.mockResolvedValue({ ...salida, tipo: 'RESPUESTA_MENSAJE', formato: 'texto' });

    const respuesta = await POST(
      peticion({
        tipo: 'RESPUESTA_MENSAJE',
        patient_id: PATIENT_ID,
        mensaje: '¿Puedo mover mi cita?',
      }),
    );

    expect(respuesta.status).toBe(200);
  });
});

describe('POST /api/v1/ai/generate — streaming', () => {
  it('emite los eventos de progreso y el resultado final como SSE', async () => {
    const salida = {
      tipo: 'PLAN',
      formato: 'estructurado',
      datos: { calorias_diarias: 2_000 },
      texto: null,
      advertencias: [],
      cuota: { ...CUOTA, usadas: 1, restantes: 14, agotada: false },
    };
    mockGenerar.mockImplementation(
      async (_userId: string, _entrada: unknown, alProgreso: (evento: unknown) => void) => {
        alProgreso({ tipo: 'progreso', caracteres: 42 });
        return salida;
      },
    );

    const respuesta = await POST(
      peticion({ tipo: 'PLAN', patient_id: PATIENT_ID, stream: true }),
    );

    expect(respuesta.headers.get('Content-Type')).toContain('text/event-stream');
    await expect(leerSse(respuesta)).resolves.toEqual([
      { evento: 'progreso', datos: { tipo: 'progreso', caracteres: 42 } },
      { evento: 'final', datos: salida },
    ]);
  });

  it('reporta el límite de cuota como evento de error dentro del stream', async () => {
    mockGenerar.mockRejectedValue(new CuotaAgotadaError(CUOTA));

    const respuesta = await POST(
      peticion({ tipo: 'PLAN', patient_id: PATIENT_ID, stream: true }),
    );
    const eventos = await leerSse(respuesta);

    // El stream ya devolvió 200, así que el fallo viaja como evento.
    expect(respuesta.status).toBe(200);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.evento).toBe('error');
    expect(eventos[0]?.datos).toMatchObject({ code: 'AI_LIMIT_REACHED' });
  });
});
