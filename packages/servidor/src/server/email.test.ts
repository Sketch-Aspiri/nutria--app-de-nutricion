import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { avisarAltaAlEquipo, enmascararCorreo } from './email';

/**
 * El envío se verifica a través del buzón de pruebas (`EMAIL_OUTBOX_FILE`), el
 * mismo desvío que usan los E2E: así se ejercita el camino real de `enviar` sin
 * llamar a Resend ni mockear el módulo entero.
 */

type CorreoEnBuzon = { para: string; asunto: string; html: string };

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));

let carpeta: string;
let buzon: string;

beforeEach(async () => {
  carpeta = await mkdtemp(path.join(tmpdir(), 'nutria-correo-'));
  buzon = path.join(carpeta, 'buzon.jsonl');
  process.env.EMAIL_OUTBOX_FILE = buzon;
  process.env.ADMIN_NOTIFY_EMAIL = 'avisos@ejemplo.mx';
});

afterEach(async () => {
  delete process.env.EMAIL_OUTBOX_FILE;
  delete process.env.ADMIN_NOTIFY_EMAIL;
  await rm(carpeta, { recursive: true, force: true });
});

async function correosEnviados(): Promise<CorreoEnBuzon[]> {
  const contenido = await readFile(buzon, 'utf8');
  return contenido
    .split('\n')
    .filter((linea) => linea.length > 0)
    .map((linea) => JSON.parse(linea) as CorreoEnBuzon);
}

/** Falla con un mensaje claro si el buzón quedó vacío, en vez de arrastrar un `undefined`. */
async function primerCorreo(): Promise<CorreoEnBuzon> {
  const [correo] = await correosEnviados();
  if (!correo) throw new Error('No llegó ningún correo al buzón de pruebas');
  return correo;
}

describe('enmascararCorreo', () => {
  it('conserva la primera y la última letra de la parte local', () => {
    expect(enmascararCorreo('andres@gmail.com')).toBe('a***s@gmail.com');
  });

  it('oculta por completo las partes locales demasiado cortas para recortar', () => {
    expect(enmascararCorreo('ab@gmail.com')).toBe('***@gmail.com');
    expect(enmascararCorreo('a@gmail.com')).toBe('***@gmail.com');
  });

  it('conserva el dominio, que sirve para distinguir tráfico real de pruebas', () => {
    expect(enmascararCorreo('paciente@consultorio.mx')).toContain('@consultorio.mx');
  });

  it('no filtra nada cuando el valor no parece un correo', () => {
    expect(enmascararCorreo('sin-arroba')).toBe('***');
    expect(enmascararCorreo('@dominio.mx')).toBe('***');
  });
});

describe('avisarAltaAlEquipo', () => {
  it('manda el nombre y el correo completo del nutriólogo, que sí es el cliente', async () => {
    const resultado = await avisarAltaAlEquipo({
      tipo: 'nutriologo',
      nombre: 'Ana Nutrióloga',
      email: 'ana@consultorio.mx',
    });

    expect(resultado).toEqual({ enviado: true });
    const correo = await primerCorreo();
    expect(correo.para).toBe('avisos@ejemplo.mx');
    expect(correo.asunto).toBe('[nutria] Alta nueva: nutriólogo');
    expect(correo.html).toContain('Ana Nutrióloga');
    expect(correo.html).toContain('ana@consultorio.mx');
  });

  it('enmascara el correo del paciente y no incluye su nombre', async () => {
    await avisarAltaAlEquipo({
      tipo: 'paciente',
      email: 'paciente@ejemplo.mx',
      consultorio: 'Consultorio Nutria',
    });

    const correo = await primerCorreo();
    expect(correo.asunto).toBe('[nutria] Alta nueva: paciente');
    expect(correo.html).toContain('p***e@ejemplo.mx');
    expect(correo.html).not.toContain('paciente@ejemplo.mx');
    expect(correo.html).toContain('Consultorio Nutria');
  });

  it('no lleva ningún dato clínico del paciente', async () => {
    await avisarAltaAlEquipo({
      tipo: 'paciente',
      email: 'paciente@ejemplo.mx',
      consultorio: 'Consultorio Nutria',
    });

    const correo = await primerCorreo();
    // Con límite de palabra: `background` contiene "kg" y no es un dato clínico.
    for (const termino of ['peso', 'kg', 'objetivo', 'plan', 'diagnóstico', 'imc']) {
      expect(correo.html).not.toMatch(new RegExp(`\\b${termino}\\b`, 'i'));
    }
  });

  it('escapa el HTML del nombre del consultorio, que lo escribe el nutriólogo', async () => {
    await avisarAltaAlEquipo({
      tipo: 'paciente',
      email: 'paciente@ejemplo.mx',
      consultorio: '<img src=x onerror=alert(1)>',
    });

    const correo = await primerCorreo();
    expect(correo.html).not.toContain('<img');
    expect(correo.html).toContain('&lt;img');
  });

  it('no envía nada si no hay buzón administrativo configurado', async () => {
    delete process.env.ADMIN_NOTIFY_EMAIL;

    const resultado = await avisarAltaAlEquipo({
      tipo: 'nutriologo',
      nombre: 'Ana',
      email: 'ana@consultorio.mx',
    });

    expect(resultado).toEqual({ enviado: false, motivo: 'sin_configurar' });
    await expect(readFile(buzon, 'utf8')).rejects.toThrow();
  });

  it('reporta el fallo sin lanzar cuando el envío no se puede completar', async () => {
    // Se envía primero para que `buzon.jsonl` exista como archivo y luego se
    // apunta "dentro" de él: una ruta imposible fuerza el error del proveedor.
    // El alta ya está guardada y no puede romperse porque el aviso interno falle.
    await avisarAltaAlEquipo({ tipo: 'nutriologo', nombre: 'Ana', email: 'ana@consultorio.mx' });
    process.env.EMAIL_OUTBOX_FILE = path.join(buzon, 'imposible.jsonl');

    await expect(
      avisarAltaAlEquipo({ tipo: 'nutriologo', nombre: 'Ana', email: 'ana@consultorio.mx' }),
    ).resolves.toEqual({ enviado: false, motivo: 'error_proveedor' });
  });
});

/**
 * Salida por SMTP de un buzón propio: es lo que permite mandar verificaciones a
 * nutriólogos reales durante la fase de prueba, sin dominio verificado.
 *
 * El módulo se recarga en cada caso porque el transporte se memoiza: sin
 * `resetModules` el segundo test reusaría el del primero.
 */
describe('envío por SMTP', () => {
  /**
   * Cargar el módulo repuebla el entorno desde los `.env` del repo, así que la
   * configuración de prueba se aplica **después** del import; si no, el
   * `EMAIL_FROM` y la llave real de Resend del archivo pisarían la del test y la
   * suite acabaría llamando al proveedor de verdad.
   */
  async function moduloConSmtp(): Promise<typeof import('./email')> {
    const modulo = await import('./email');
    delete process.env.EMAIL_OUTBOX_FILE;
    delete process.env.EMAIL_FROM;
    process.env.SMTP_HOST = 'smtp.gmail.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'consultorio@gmail.com';
    process.env.SMTP_PASSWORD = 'contrasena-de-aplicacion';
    process.env.RESEND_API_KEY = 're_no_debe_usarse';
    return modulo;
  }

  beforeEach(() => {
    jest.resetModules();
    mockSendMail.mockReset().mockResolvedValue({ messageId: 'x' });
    mockCreateTransport.mockClear();
  });

  afterEach(() => {
    for (const clave of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']) {
      delete process.env[clave];
    }
  });

  it('manda la verificación por SMTP y deja Resend de lado', async () => {
    const { enviarVerificacionEmail } = await moduloConSmtp();

    const resultado = await enviarVerificacionEmail('nueva@nutriologa.mx', 'tok-123');

    expect(resultado).toEqual({ enviado: true });
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: 'consultorio@gmail.com', pass: 'contrasena-de-aplicacion' },
      }),
    );
    const [correo] = mockSendMail.mock.calls[0] as [Record<string, string>];
    expect(correo.to).toBe('nueva@nutriologa.mx');
    expect(correo.html).toContain('tok-123');
  });

  it('usa el buzón autenticado como remitente cuando no hay EMAIL_FROM', async () => {
    const { enviarVerificacionEmail } = await moduloConSmtp();

    await enviarVerificacionEmail('nueva@nutriologa.mx', 'tok-123');

    const [correo] = mockSendMail.mock.calls[0] as [Record<string, string>];
    expect(correo.from).toBe('nutria <consultorio@gmail.com>');
  });

  it('no toca el servidor SMTP si el buzón de pruebas está activo', async () => {
    const { enviarVerificacionEmail } = await moduloConSmtp();
    process.env.EMAIL_OUTBOX_FILE = buzon;

    await expect(enviarVerificacionEmail('nueva@nutriologa.mx', 'tok-123')).resolves.toEqual({
      enviado: true,
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('reporta el fallo sin lanzar cuando el servidor SMTP rechaza el envío', async () => {
    const { enviarVerificacionEmail } = await moduloConSmtp();
    mockSendMail.mockRejectedValue(new Error('535 credenciales inválidas'));

    await expect(enviarVerificacionEmail('nueva@nutriologa.mx', 'tok-123')).resolves.toEqual(
      // En entorno de desarrollo la respuesta agrega `enlaceDev` para no dejar
      // al nutriólogo sin manera de verificarse; el motivo es lo que importa.
      expect.objectContaining({ enviado: false, motivo: 'error_proveedor' }),
    );
  });

  it('ignora una configuración SMTP incompleta y cae al proveedor por API', async () => {
    const { enviarVerificacionEmail } = await moduloConSmtp();
    delete process.env.SMTP_PASSWORD;
    delete process.env.RESEND_API_KEY;

    await expect(enviarVerificacionEmail('nueva@nutriologa.mx', 'tok-123')).resolves.toEqual(
      expect.objectContaining({ enviado: false, motivo: 'sin_configurar' }),
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });
});
