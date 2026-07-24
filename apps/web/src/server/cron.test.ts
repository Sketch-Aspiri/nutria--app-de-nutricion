/**
 * @jest-environment node
 */
import { verificarCron } from './cron';

const SECRETO = 'secreto-de-prueba-para-el-cron';

function peticion(authorization?: string): Request {
  return new Request('https://nutria.test/api/v1/cron/appointment_reminders', {
    headers: authorization ? { authorization } : {},
  });
}

const secretoOriginal = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = secretoOriginal;
});

describe('verificarCron', () => {
  it('deja pasar la petición del programador con el secreto correcto', () => {
    process.env.CRON_SECRET = SECRETO;

    expect(verificarCron(peticion(`Bearer ${SECRETO}`))).toBeNull();
  });

  it('rechaza un secreto equivocado', async () => {
    process.env.CRON_SECRET = SECRETO;

    const respuesta = verificarCron(peticion('Bearer otro-secreto-cualquiera'));

    expect(respuesta?.status).toBe(401);
  });

  it('rechaza la petición sin cabecera de autorización', () => {
    process.env.CRON_SECRET = SECRETO;

    expect(verificarCron(peticion())?.status).toBe(401);
  });

  it('rechaza un esquema que no sea Bearer', () => {
    process.env.CRON_SECRET = SECRETO;

    expect(verificarCron(peticion(`Basic ${SECRETO}`))?.status).toBe(401);
  });

  it('rechaza un secreto correcto pero con basura al final', () => {
    process.env.CRON_SECRET = SECRETO;

    expect(verificarCron(peticion(`Bearer ${SECRETO}x`))?.status).toBe(401);
  });

  it('cierra la ruta cuando no hay CRON_SECRET configurado', () => {
    delete process.env.CRON_SECRET;

    // Abrirla "mientras tanto" dejaría un amplificador de correo público.
    const respuesta = verificarCron(peticion('Bearer lo-que-sea'));

    expect(respuesta?.status).toBe(503);
  });
});
