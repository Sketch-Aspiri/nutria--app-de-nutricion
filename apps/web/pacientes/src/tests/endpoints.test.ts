/**
 * @jest-environment node
 */
import { ErrorCode, jsonError } from '@/server/http';

/**
 * Comportamiento de cada handler de `/api/v1/me/*` con sesión válida: caso
 * feliz, validación del payload y límite de tasa.
 *
 * La autorización se prueba aparte, en `autorizacion.test.ts`.
 */

const PACIENTE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const mockLimiteEscritura = jest.fn();
const mockLimiteFotos = jest.fn();
const mockSubirFoto = jest.fn();

jest.mock('@/server/auth/guards', () => ({
  requierePaciente: jest.fn().mockResolvedValue({
    ok: true,
    sesion: { user: { id: '22222222-2222-4222-8222-222222222222' } },
    userId: '22222222-2222-4222-8222-222222222222',
    patientId: '11111111-1111-4111-8111-111111111111',
  }),
}));

const repositorio = {
  perfilDe: jest.fn(),
  resumenDeHoy: jest.fn(),
  planVigente: jest.fn(),
  recetasEnviadas: jest.fn(),
  planActividadCompartido: jest.fn(),
  registrarComida: jest.fn(),
  borrarComida: jest.fn(),
  listarPesos: jest.fn(),
  registrarPeso: jest.fn(),
  listarEjercicio: jest.fn(),
  registrarEjercicio: jest.fn(),
  guardarAgua: jest.fn(),
  resumenDeProgreso: jest.fn(),
  listarMensajes: jest.fn(),
  enviarMensaje: jest.fn(),
  marcarMensajesLeidos: jest.fn(),
  contarMensajesSinLeer: jest.fn(),
  proximasCitas: jest.fn(),
};

jest.mock('@/server/me/repository', () => repositorio);
jest.mock('@/server/me/limites', () => ({
  limiteDeEscritura: (...a: unknown[]) => mockLimiteEscritura(...a),
  limiteDeFotos: (...a: unknown[]) => mockLimiteFotos(...a),
}));
jest.mock('@/server/me/fotos', () => ({
  MAX_FOTO_BYTES: 5 * 1024 * 1024,
  subirFotoComida: (...a: unknown[]) => mockSubirFoto(...a),
}));

const AHORA = new Date('2026-07-28T12:00:00Z');

function json(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost:3001/api/v1/me', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function cuerpo<T>(respuesta: Response): Promise<T> {
  return (await respuesta.json()) as T;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLimiteEscritura.mockResolvedValue({ permitido: true });
  mockLimiteFotos.mockResolvedValue({ permitido: true });
});

describe('GET /me', () => {
  it('devuelve el perfil con las metas del plan vigente', async () => {
    repositorio.perfilDe.mockResolvedValue({
      id: PACIENTE_ID,
      nombre: 'Ana',
      email: 'ana@ejemplo.mx',
      fotoUrl: null,
      objetivo: 'PERDIDA_DE_GRASA',
      objetivoOtro: null,
      nutriologo: { nombre: 'Dra. Ruiz', consultorio: 'Nutria' },
      metaAguaVasos: 8,
      metas: { caloriasDiarias: 1800, proteinaG: 120, carbosG: 180, grasaG: 60 },
    });
    const { GET } = await import('@/app/api/v1/me/route');

    const respuesta = await GET();
    const perfil = await cuerpo<{ metas: { calorias_diarias: number } }>(respuesta);

    expect(respuesta.status).toBe(200);
    expect(perfil.metas.calorias_diarias).toBe(1800);
    expect(repositorio.perfilDe).toHaveBeenCalledWith(PACIENTE_ID);
  });

  it('responde 404 si el expediente ya no existe', async () => {
    repositorio.perfilDe.mockResolvedValue(null);
    const { GET } = await import('@/app/api/v1/me/route');

    expect((await GET()).status).toBe(404);
  });
});

describe('GET /me/meal_plan', () => {
  it('devuelve null en vez de 404 cuando no hay plan compartido', async () => {
    repositorio.planVigente.mockResolvedValue(null);
    const { GET } = await import('@/app/api/v1/me/meal_plan/route');

    const respuesta = await GET();

    expect(respuesta.status).toBe(200);
    expect(await cuerpo(respuesta)).toBeNull();
  });
});

describe('POST /me/meal_logs', () => {
  it('registra la comida y devuelve 201', async () => {
    repositorio.registrarComida.mockResolvedValue({
      comida: {
        id: 'log-1',
        mealPlanMealId: null,
        fecha: AHORA,
        hora: AHORA,
        nombre: 'Ensalada',
        calorias: 210,
        proteinaG: null,
        carbosG: null,
        grasaG: null,
        origen: 'MANUAL',
        fotoUrl: null,
        comentarioPaciente: null,
        createdAt: AHORA,
      },
      zonaHoraria: 'America/Mexico_City',
    });
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const respuesta = await POST(json({ nombre: 'Ensalada', calorias: 210 }));

    expect(respuesta.status).toBe(201);
    expect(repositorio.registrarComida).toHaveBeenCalledWith(
      PACIENTE_ID,
      expect.objectContaining({ nombre: 'Ensalada', calorias: 210 }),
    );
  });

  it('no expone el comentario que el nutriólogo escribió sobre la comida', async () => {
    repositorio.registrarComida.mockResolvedValue({
      comida: {
        id: 'log-1',
        mealPlanMealId: null,
        fecha: AHORA,
        hora: null,
        nombre: 'Ensalada',
        calorias: null,
        proteinaG: null,
        carbosG: null,
        grasaG: null,
        origen: 'MANUAL',
        fotoUrl: null,
        comentarioPaciente: null,
        comentarioNutriologo: 'Revisar porciones con la paciente',
        createdAt: AHORA,
      },
      zonaHoraria: 'America/Mexico_City',
    });
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const texto = await (await POST(json({ nombre: 'Ensalada' }))).text();

    expect(texto).not.toContain('Revisar porciones');
  });

  it('rechaza el payload sin nombre con 400 y detalle del campo', async () => {
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const respuesta = await POST(json({ calorias: 100 }));
    const error = await cuerpo<{ error: { code: string; details: Record<string, string[]> } }>(
      respuesta,
    );

    expect(respuesta.status).toBe(400);
    expect(error.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.error.details).toHaveProperty('nombre');
    expect(repositorio.registrarComida).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const respuesta = await POST(
      new Request('http://localhost:3001/api/v1/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'no soy json',
      }),
    );

    expect(respuesta.status).toBe(400);
    expect((await cuerpo<{ error: { code: string } }>(respuesta)).error.code).toBe(
      ErrorCode.INVALID_BODY,
    );
  });

  it('responde 404 si la comida del plan es de otro paciente', async () => {
    repositorio.registrarComida.mockResolvedValue(null);
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const respuesta = await POST(
      json({ nombre: 'Ajena', meal_plan_meal_id: '33333333-3333-4333-8333-333333333333' }),
    );

    expect(respuesta.status).toBe(404);
  });

  it('corta con 429 cuando se excede el límite de escritura', async () => {
    mockLimiteEscritura.mockResolvedValue({
      permitido: false,
      respuesta: jsonError(429, ErrorCode.RATE_LIMITED, 'Demasiadas peticiones.'),
    });
    const { POST } = await import('@/app/api/v1/me/meal_logs/route');

    const respuesta = await POST(json({ nombre: 'Ensalada' }));

    expect(respuesta.status).toBe(429);
    expect(mockLimiteEscritura).toHaveBeenCalledWith(USER_ID);
    expect(repositorio.registrarComida).not.toHaveBeenCalled();
  });
});

describe('DELETE /me/meal_logs/{id}', () => {
  it('responde 204 al desmarcar', async () => {
    repositorio.borrarComida.mockResolvedValue(true);
    const { DELETE } = await import('@/app/api/v1/me/meal_logs/[id]/route');

    const respuesta = await DELETE(json({}, 'DELETE'), {
      params: Promise.resolve({ id: 'log-1' }),
    });

    expect(respuesta.status).toBe(204);
    expect(repositorio.borrarComida).toHaveBeenCalledWith(PACIENTE_ID, 'log-1');
  });

  it('responde 404 cuando el registro no es del paciente', async () => {
    repositorio.borrarComida.mockResolvedValue(false);
    const { DELETE } = await import('@/app/api/v1/me/meal_logs/[id]/route');

    const respuesta = await DELETE(json({}, 'DELETE'), {
      params: Promise.resolve({ id: 'ajeno' }),
    });

    expect(respuesta.status).toBe(404);
  });
});

describe('POST /me/weight_logs', () => {
  it.each([
    ['peso fuera de rango', { fecha: '2026-07-28', peso_kg: 5 }],
    ['fecha con formato inválido', { fecha: '28/07/2026', peso_kg: 70 }],
    ['sin fecha', { peso_kg: 70 }],
  ])('rechaza %s con 400', async (_caso, payload) => {
    const { POST } = await import('@/app/api/v1/me/weight_logs/route');

    expect((await POST(json(payload))).status).toBe(400);
    expect(repositorio.registrarPeso).not.toHaveBeenCalled();
  });

  it('acepta un peso válido', async () => {
    repositorio.registrarPeso.mockResolvedValue({
      id: 'peso-1',
      fecha: new Date('2026-07-28T00:00:00Z'),
      pesoKg: 74.2,
      createdAt: AHORA,
    });
    const { POST } = await import('@/app/api/v1/me/weight_logs/route');

    const respuesta = await POST(json({ fecha: '2026-07-28', peso_kg: 74.2 }));

    expect(respuesta.status).toBe(201);
    expect((await cuerpo<{ peso_kg: number }>(respuesta)).peso_kg).toBe(74.2);
  });
});

describe('PUT /me/water_logs', () => {
  it('guarda el total de vasos del día', async () => {
    repositorio.guardarAgua.mockResolvedValue({
      fecha: new Date('2026-07-28T00:00:00Z'),
      vasos: 5,
      updatedAt: AHORA,
    });
    const { PUT } = await import('@/app/api/v1/me/water_logs/route');

    const respuesta = await PUT(json({ fecha: '2026-07-28', vasos: 5 }, 'PUT'));

    expect(respuesta.status).toBe(200);
    expect(await cuerpo(respuesta)).toMatchObject({ fecha: '2026-07-28', vasos: 5 });
  });

  it('rechaza un número de vasos absurdo', async () => {
    const { PUT } = await import('@/app/api/v1/me/water_logs/route');

    expect((await PUT(json({ fecha: '2026-07-28', vasos: 500 }, 'PUT'))).status).toBe(400);
  });
});

describe('GET /me/messages', () => {
  it('incluye el conteo sin leer para la nav inferior', async () => {
    repositorio.listarMensajes.mockResolvedValue([
      {
        id: 'm1',
        emisor: 'NUTRITIONIST',
        texto: 'Hola',
        leidoAt: null,
        createdAt: AHORA,
      },
    ]);
    repositorio.contarMensajesSinLeer.mockResolvedValue(1);
    const { GET } = await import('@/app/api/v1/me/messages/route');

    const respuesta = await GET();
    const lista = await cuerpo<{ data: unknown[]; meta: { sin_leer: number } }>(respuesta);

    expect(lista.data).toHaveLength(1);
    expect(lista.meta.sin_leer).toBe(1);
  });
});

describe('POST /me/messages', () => {
  it('envía el mensaje del paciente', async () => {
    repositorio.enviarMensaje.mockResolvedValue({
      id: 'm2',
      emisor: 'PATIENT',
      texto: 'Gracias',
      leidoAt: null,
      createdAt: AHORA,
    });
    const { POST } = await import('@/app/api/v1/me/messages/route');

    const respuesta = await POST(json({ texto: 'Gracias' }));

    expect(respuesta.status).toBe(201);
    expect(repositorio.enviarMensaje).toHaveBeenCalledWith(PACIENTE_ID, 'Gracias');
  });

  it('rechaza un mensaje vacío', async () => {
    const { POST } = await import('@/app/api/v1/me/messages/route');

    expect((await POST(json({ texto: '   ' }))).status).toBe(400);
  });
});

describe('GET /me/appointments', () => {
  it('no expone las notas de la cita, que son del nutriólogo', async () => {
    repositorio.proximasCitas.mockResolvedValue([
      {
        id: 'cita-1',
        inicio: AHORA,
        duracionMin: 45,
        tipo: 'PRESENCIAL',
        estado: 'PROGRAMADA',
        videoUrl: null,
        notas: 'Paciente ansiosa por la báscula',
      },
    ]);
    const { GET } = await import('@/app/api/v1/me/appointments/route');

    const texto = await (await GET()).text();

    expect(texto).toContain('cita-1');
    expect(texto).not.toContain('ansiosa');
  });
});

describe('POST /me/photos', () => {
  function conArchivo(bytes: number[], nombre = 'comida.jpg'): Request {
    const form = new FormData();
    form.append('foto', new File([new Uint8Array(bytes).buffer], nombre, { type: 'image/jpeg' }));
    return new Request('http://localhost:3001/api/v1/me/photos', { method: 'POST', body: form });
  }

  it('devuelve la URL de la foto subida', async () => {
    mockSubirFoto.mockResolvedValue({ ok: true, url: 'https://x.public.blob.vercel-storage.com/a' });
    const { POST } = await import('@/app/api/v1/me/photos/route');

    const respuesta = await POST(conArchivo([0xff, 0xd8, 0xff]));

    expect(respuesta.status).toBe(201);
    expect(await cuerpo(respuesta)).toEqual({
      foto_url: 'https://x.public.blob.vercel-storage.com/a',
    });
  });

  it('responde 400 si no viene el archivo', async () => {
    const { POST } = await import('@/app/api/v1/me/photos/route');

    const respuesta = await POST(
      new Request('http://localhost:3001/api/v1/me/photos', {
        method: 'POST',
        body: new FormData(),
      }),
    );

    expect(respuesta.status).toBe(400);
    expect(mockSubirFoto).not.toHaveBeenCalled();
  });

  it('responde 422 ante un formato que no es imagen', async () => {
    mockSubirFoto.mockResolvedValue({ ok: false, motivo: 'formato_no_soportado' });
    const { POST } = await import('@/app/api/v1/me/photos/route');

    const respuesta = await POST(conArchivo([0x3c, 0x73, 0x76, 0x67], 'x.svg'));

    expect(respuesta.status).toBe(422);
  });

  it('corta con 429 cuando se excede el límite horario de fotos', async () => {
    mockLimiteFotos.mockResolvedValue({
      permitido: false,
      respuesta: jsonError(429, ErrorCode.RATE_LIMITED, 'Demasiadas fotos.'),
    });
    const { POST } = await import('@/app/api/v1/me/photos/route');

    const respuesta = await POST(conArchivo([0xff, 0xd8, 0xff]));

    expect(respuesta.status).toBe(429);
    expect(mockSubirFoto).not.toHaveBeenCalled();
  });
});
