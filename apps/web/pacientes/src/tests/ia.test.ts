/**
 * @jest-environment node
 */

/**
 * Comportamiento de los tres endpoints de IA del paciente (§8 del plan) con
 * sesión válida: caso feliz, validación del cuerpo, límite de ráfaga, servidor
 * sin llave y traducción de los errores del servicio.
 *
 * La autorización se prueba aparte, en `autorizacion.test.ts`.
 */

const mockLimiteIa = jest.fn();
const mockIaConfigurada = jest.fn();

const servicio = {
  responderCoach: jest.fn(),
  estimarComida: jest.fn(),
  sustituirIngrediente: jest.fn(),
};

class CuotaPacienteAgotadaError extends Error {
  constructor(readonly cuota: { limite: number }) {
    super('CUOTA_IA_PACIENTE_AGOTADA');
  }
}
class SalidaIaInvalidaError extends Error {
  constructor(readonly motivo: string) {
    super('SALIDA_IA_INVALIDA');
  }
}
class RecetaNoEncontradaError extends Error {}
class CuotaClinicaAgotadaError extends Error {}
class PacienteSinExpedienteError extends Error {}

jest.mock('@/server/auth/guards', () => ({
  requierePaciente: jest.fn().mockResolvedValue({
    ok: true,
    sesion: { user: { id: '22222222-2222-4222-8222-222222222222' } },
    userId: '22222222-2222-4222-8222-222222222222',
    patientId: '11111111-1111-4111-8111-111111111111',
  }),
}));

jest.mock('@/server/me/limites', () => ({
  limiteDeIa: (...args: unknown[]) => mockLimiteIa(...args),
}));

jest.mock('@/server/ai/cliente', () => ({
  iaConfigurada: () => mockIaConfigurada(),
  IaNoConfiguradaError: class extends Error {},
  IaUpstreamError: class extends Error {},
}));

jest.mock('@/server/ai/servicioPaciente', () => ({
  responderCoach: (...args: unknown[]) => servicio.responderCoach(...args),
  estimarComida: (...args: unknown[]) => servicio.estimarComida(...args),
  sustituirIngrediente: (...args: unknown[]) => servicio.sustituirIngrediente(...args),
  CuotaClinicaAgotadaError,
  CuotaPacienteAgotadaError,
  PacienteSinExpedienteError,
  RecetaNoEncontradaError,
  SalidaIaInvalidaError,
}));

const PACIENTE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function json(body: unknown): Request {
  return new Request('http://localhost:3001/api/v1/me/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function cuerpo<T>(respuesta: Response): Promise<T> {
  return (await respuesta.json()) as T;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLimiteIa.mockResolvedValue({ permitido: true });
  mockIaConfigurada.mockReturnValue(true);
});

describe('POST /me/ai/coach', () => {
  const CUOTA = { limite: 30, usadas: 1, restantes: 29, agotada: false };

  it('devuelve la respuesta del coach con su aviso', async () => {
    servicio.responderCoach.mockResolvedValue({
      tipo: 'COACH_PACIENTE',
      formato: 'texto',
      texto: 'Toma agua entre comidas.',
      aviso: 'Orientación general. No sustituye a tu nutrióloga.',
      cuota: CUOTA,
    });
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    const respuesta = await POST(json({ mensaje: '¿Cuánta agua tomo?' }));

    expect(respuesta.status).toBe(200);
    expect(await cuerpo(respuesta)).toMatchObject({
      texto: 'Toma agua entre comidas.',
      aviso: expect.stringContaining('No sustituye'),
    });
  });

  it('pasa el paciente de la sesión, no uno del cuerpo', async () => {
    servicio.responderCoach.mockResolvedValue({ texto: 'ok', aviso: '', cuota: CUOTA });
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    await POST(json({ mensaje: 'Hola', patient_id: 'otro-paciente' }));

    expect(servicio.responderCoach).toHaveBeenCalledWith(PACIENTE_ID, USER_ID, {
      mensaje: 'Hola',
    });
  });

  it('rechaza un mensaje vacío con 400', async () => {
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    const respuesta = await POST(json({ mensaje: '  ' }));

    expect(respuesta.status).toBe(400);
    expect(servicio.responderCoach).not.toHaveBeenCalled();
  });

  it('responde 429 cuando el paciente dispara ráfagas', async () => {
    mockLimiteIa.mockResolvedValue({
      permitido: false,
      respuesta: new Response(null, { status: 429 }),
    });
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    expect((await POST(json({ mensaje: 'Hola' }))).status).toBe(429);
    expect(servicio.responderCoach).not.toHaveBeenCalled();
  });

  it('responde 503 si el servidor no tiene llave de IA', async () => {
    mockIaConfigurada.mockReturnValue(false);
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    const respuesta = await POST(json({ mensaje: 'Hola' }));

    expect(respuesta.status).toBe(503);
    expect(servicio.responderCoach).not.toHaveBeenCalled();
  });

  it('traduce el tope mensual agotado a 429', async () => {
    servicio.responderCoach.mockRejectedValue(new CuotaPacienteAgotadaError({ limite: 30 }));
    const { POST } = await import('@/app/api/v1/me/ai/coach/route');

    const respuesta = await POST(json({ mensaje: 'Hola' }));

    expect(respuesta.status).toBe(429);
    expect((await cuerpo<{ error: { code: string } }>(respuesta)).error.code).toBe(
      'AI_LIMIT_REACHED',
    );
  });
});

describe('POST /me/ai/meal_estimate', () => {
  const ESTIMACION = {
    tipo: 'ESTIMACION_COMIDA',
    formato: 'estructurado',
    datos: { alimento: '2 tacos', calorias: 420, proteina_g: 28, carbos_g: 40, grasa_g: 15 },
    aviso: 'Orientación general. No sustituye a tu nutrióloga.',
    cuota: { limite: 30, usadas: 2, restantes: 28, agotada: false },
  };

  it('devuelve la estimación sin registrarla en el diario', async () => {
    servicio.estimarComida.mockResolvedValue(ESTIMACION);
    const { POST } = await import('@/app/api/v1/me/ai/meal_estimate/route');

    const respuesta = await POST(json({ texto: '2 tacos de pollo' }));

    expect(respuesta.status).toBe(200);
    // El endpoint devuelve; guardar es cosa de POST /me/meal_logs con origen IA.
    expect(await cuerpo(respuesta)).toMatchObject({ datos: { calorias: 420 } });
  });

  it('rechaza una descripción vacía', async () => {
    const { POST } = await import('@/app/api/v1/me/ai/meal_estimate/route');

    expect((await POST(json({ texto: '' }))).status).toBe(400);
  });

  it('traduce una salida inválida del modelo a 422 con su motivo', async () => {
    servicio.estimarComida.mockRejectedValue(
      new SalidaIaInvalidaError('No pude estimar esa comida.'),
    );
    const { POST } = await import('@/app/api/v1/me/ai/meal_estimate/route');

    const respuesta = await POST(json({ texto: 'algo raro' }));

    expect(respuesta.status).toBe(422);
    expect((await cuerpo<{ error: { message: string } }>(respuesta)).error.message).toBe(
      'No pude estimar esa comida.',
    );
  });
});

describe('POST /me/ai/substitution', () => {
  it('devuelve el sustituto propuesto', async () => {
    servicio.sustituirIngrediente.mockResolvedValue({
      tipo: 'SUSTITUCION_INGREDIENTE',
      formato: 'estructurado',
      datos: { sustituto: '1 taza de frijol', razon: 'Aporta proteína parecida.' },
      aviso: 'Orientación general. No sustituye a tu nutrióloga.',
      cuota: { limite: 30, usadas: 3, restantes: 27, agotada: false },
    });
    const { POST } = await import('@/app/api/v1/me/ai/substitution/route');

    const respuesta = await POST(json({ ingrediente: 'pollo' }));

    expect(respuesta.status).toBe(200);
    expect(await cuerpo(respuesta)).toMatchObject({ datos: { sustituto: '1 taza de frijol' } });
  });

  it('rechaza un identificador de receta mal formado sin llamar al servicio', async () => {
    const { POST } = await import('@/app/api/v1/me/ai/substitution/route');

    const respuesta = await POST(json({ ingrediente: 'pollo', receta_id: '123' }));

    expect(respuesta.status).toBe(400);
    expect(servicio.sustituirIngrediente).not.toHaveBeenCalled();
  });

  it('traduce una receta ajena o no enviada a 404', async () => {
    servicio.sustituirIngrediente.mockRejectedValue(new RecetaNoEncontradaError());
    const { POST } = await import('@/app/api/v1/me/ai/substitution/route');

    const respuesta = await POST(
      json({ ingrediente: 'pollo', receta_id: '33333333-3333-4333-8333-333333333333' }),
    );

    expect(respuesta.status).toBe(404);
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { POST } = await import('@/app/api/v1/me/ai/substitution/route');

    const respuesta = await POST(
      new Request('http://localhost:3001/api/v1/me/ai/substitution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'no soy json',
      }),
    );

    expect(respuesta.status).toBe(400);
  });
});
