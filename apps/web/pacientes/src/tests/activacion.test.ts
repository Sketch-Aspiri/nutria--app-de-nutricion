/**
 * @jest-environment node
 */
import { ErrorCode } from '@/server/http';

/**
 * `POST /api/v1/auth/activate` — la única ruta de escritura sin sesión de la
 * app del paciente, y por tanto la única expuesta a quien pruebe tokens al azar.
 *
 * La transacción de activación ya la probó la fase 3 en `invitaciones.test.ts`;
 * lo que se verifica aquí es la envoltura HTTP que añadió la fase 6: límite por
 * IP, validación del consentimiento y —lo importante— dónde pasa la línea entre
 * lo que se le explica al paciente y lo que se le calla a quien prueba tokens.
 */

const mockActivar = jest.fn();
const mockRateLimit = jest.fn();

jest.mock('@/server/auth/invitaciones', () => ({
  activarCuentaPaciente: (...args: unknown[]) => mockActivar(...args),
}));

jest.mock('@/server/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  ipDe: (request: Request) => request.headers.get('x-forwarded-for') ?? 'desconocida',
}));

const TOKEN = 'a'.repeat(64);
const PASSWORD = 'contraseña-larga-y-seg';

function peticion(body: unknown, ip = '203.0.113.10'): Request {
  return new Request('https://pacientes.nutria.mx/api/v1/auth/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function activar(body: unknown, ip?: string) {
  const { POST } = await import('@/app/api/v1/auth/activate/route');
  const respuesta = await POST(peticion(body, ip));
  return { respuesta, cuerpo: await respuesta.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockResolvedValue({ permitido: true });
  mockActivar.mockResolvedValue({ ok: true, email: 'paciente@ejemplo.mx' });
});

describe('caso feliz', () => {
  it('crea la cuenta y devuelve 201 con el correo para prellenar el acceso', async () => {
    const { respuesta, cuerpo } = await activar({
      token: TOKEN,
      password: PASSWORD,
      acepta_privacidad: true,
    });

    expect(respuesta.status).toBe(201);
    // Recurso individual: `jsonCreated` lo devuelve sin envolver en `data`.
    expect(cuerpo).toEqual({ email: 'paciente@ejemplo.mx' });
    expect(mockActivar).toHaveBeenCalledWith(TOKEN, PASSWORD);
  });

  it('no devuelve el token ni el identificador del expediente', async () => {
    mockActivar.mockResolvedValue({
      ok: true,
      email: 'paciente@ejemplo.mx',
      patientId: '11111111-1111-4111-8111-111111111111',
    });

    const { cuerpo } = await activar({
      token: TOKEN,
      password: PASSWORD,
      acepta_privacidad: true,
    });

    expect(JSON.stringify(cuerpo)).not.toContain(TOKEN);
    expect(JSON.stringify(cuerpo)).not.toContain('11111111');
  });
});

describe('validación', () => {
  it('rechaza sin consentimiento de privacidad y no toca la base', async () => {
    const { respuesta, cuerpo } = await activar({
      token: TOKEN,
      password: PASSWORD,
      acepta_privacidad: false,
    });

    // 400, no 422: `api-conventions.md` reserva el 422 para reglas de negocio
    // violadas; un payload que no pasa el esquema es un 400.
    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    // La garantía de fondo: sin un acto real del paciente no se sella
    // `privacy_notice_accepted_at`.
    expect(mockActivar).not.toHaveBeenCalled();
  });

  it.each([
    ['token vacío', { token: '', password: PASSWORD, acepta_privacidad: true }],
    ['contraseña corta', { token: TOKEN, password: 'corta', acepta_privacidad: true }],
    ['sin campos', {}],
  ])('rechaza %s con 400', async (_caso, body) => {
    const { respuesta } = await activar(body);
    expect(respuesta.status).toBe(400);
    expect(mockActivar).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { respuesta, cuerpo } = await activar('{ esto no es json');
    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe(ErrorCode.INVALID_BODY);
  });
});

describe('rechazos', () => {
  const MOTIVOS = [
    'invalido',
    'reemplazado',
    'expirado',
    'ya_vinculado',
    'paciente_inactivo',
    'correo_ocupado',
  ] as const;

  async function rechazar(motivo: (typeof MOTIVOS)[number]) {
    mockActivar.mockResolvedValue({ ok: false, motivo });
    return activar({ token: TOKEN, password: PASSWORD, acepta_privacidad: true });
  }

  it.each(MOTIVOS)('responde 400 INVALID_TOKEN ante %s', async (motivo) => {
    const { respuesta, cuerpo } = await rechazar(motivo);

    expect(respuesta.status).toBe(400);
    expect(cuerpo.error.code).toBe(ErrorCode.INVALID_TOKEN);
  });

  /**
   * Quien prueba tokens al azar solo puede caer en `invalido`: los demás motivos
   * exigen que el token exista en la base, o sea, haberlo recibido por correo.
   * Por eso el estado del expediente —archivado, correo ya registrado— sigue
   * detrás del mismo mensaje que un token inventado.
   */
  it.each(['invalido', 'paciente_inactivo', 'correo_ocupado'] as const)(
    'no revela el estado del expediente en %s',
    async (motivo) => {
      const { cuerpo } = await rechazar(motivo);
      const generico = (await rechazar('invalido')).cuerpo;

      expect(cuerpo).toEqual(generico);
      expect(cuerpo.error.message).not.toMatch(/inactiv|archivad|registrad|ocupad/i);
    },
  );

  it('manda al paciente al correo más reciente cuando su enlace fue reemplazado', async () => {
    const { cuerpo } = await rechazar('reemplazado');

    expect(cuerpo.error.message).toMatch(/más reciente/i);
    // Pedir otro reenvío es justo lo que no lo desatora: generaría un tercer
    // correo y el mismo error.
    expect(cuerpo.error.message).not.toMatch(/reenv/i);
  });

  it('manda a iniciar sesión cuando la invitación ya creó la cuenta', async () => {
    const { cuerpo } = await rechazar('ya_vinculado');

    expect(cuerpo.error.message).toMatch(/entra/i);
  });

  it('ofrece un reenvío cuando el enlace venció', async () => {
    const { cuerpo } = await rechazar('expirado');

    expect(cuerpo.error.message).toMatch(/reenv/i);
  });
});

describe('límite de tasa', () => {
  it('cuenta los intentos por IP, no por cuenta', async () => {
    await activar({ token: TOKEN, password: PASSWORD, acepta_privacidad: true }, '198.51.100.7');

    const [clave] = mockRateLimit.mock.calls[0] ?? [];
    expect(clave).toBe('activar:198.51.100.7');
  });

  it('responde 429 sin intentar la activación', async () => {
    mockRateLimit.mockResolvedValue({ permitido: false, reintentarEnSegundos: 60 });

    const { respuesta, cuerpo } = await activar({
      token: TOKEN,
      password: PASSWORD,
      acepta_privacidad: true,
    });

    expect(respuesta.status).toBe(429);
    expect(cuerpo.error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(mockActivar).not.toHaveBeenCalled();
  });

  it('el límite se aplica antes de leer el cuerpo', async () => {
    // Si se validara primero, un atacante podría sondear el esquema sin gastar
    // cuota. Con cuerpo inválido y límite agotado, gana el 429.
    mockRateLimit.mockResolvedValue({ permitido: false, reintentarEnSegundos: 60 });
    const { respuesta } = await activar('{ roto');
    expect(respuesta.status).toBe(429);
  });
});

describe('fallo inesperado', () => {
  it('devuelve 500 genérico y no filtra el error interno', async () => {
    mockActivar.mockRejectedValue(new Error(`falló el token ${TOKEN}`));

    const { respuesta, cuerpo } = await activar({
      token: TOKEN,
      password: PASSWORD,
      acepta_privacidad: true,
    });

    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(cuerpo)).not.toContain(TOKEN);
  });
});
