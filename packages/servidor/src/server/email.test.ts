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
    const [correo] = await correosEnviados();
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

    const [correo] = await correosEnviados();
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

    const [correo] = await correosEnviados();
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

    const [correo] = await correosEnviados();
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
