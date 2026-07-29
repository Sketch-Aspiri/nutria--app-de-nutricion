/**
 * @jest-environment node
 */
import { requierePaciente } from './guards';

const mockAuth = jest.fn();
const mockFindFirst = jest.fn();

jest.mock('./index', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

jest.mock('@/server/db', () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));

jest.mock('@/server/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const SESION = { user: { id: 'user-1' } };

const PACIENTE_ACTIVO = {
  role: 'END_USER',
  patientAccount: { id: 'pac-1', estado: 'ACTIVO', deletedAt: null },
};

async function estadoDe(respuesta: Response): Promise<{ status: number; code: string }> {
  const cuerpo = (await respuesta.json()) as { error: { code: string } };
  return { status: respuesta.status, code: cuerpo.error.code };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue(SESION);
});

describe('requierePaciente', () => {
  it('resuelve el paciente vinculado a la sesión', async () => {
    mockFindFirst.mockResolvedValue(PACIENTE_ACTIVO);

    const resultado = await requierePaciente();

    expect(resultado).toMatchObject({ ok: true, userId: 'user-1', patientId: 'pac-1' });
  });

  it('resuelve el paciente en el servidor, nunca desde la petición', async () => {
    mockFindFirst.mockResolvedValue(PACIENTE_ACTIVO);

    await requierePaciente();

    // El id del usuario sale de la sesión y el del paciente de la relación:
    // ningún endpoint puede inyectar un patient_id ajeno.
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1', deletedAt: null } }),
    );
  });

  it('rechaza sin sesión con 401', async () => {
    mockAuth.mockResolvedValue(null);

    const resultado = await requierePaciente();

    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('rechaza con 401 al usuario borrado, que la consulta ya filtra', async () => {
    mockFindFirst.mockResolvedValue(null);

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('rechaza con 403 al nutriólogo que entra a la app del paciente', async () => {
    mockFindFirst.mockResolvedValue({ role: 'NUTRITIONIST', patientAccount: null });

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({ status: 403, code: 'FORBIDDEN' });
  });

  it('rechaza con 403 a la cuenta sin expediente vinculado', async () => {
    mockFindFirst.mockResolvedValue({ role: 'END_USER', patientAccount: null });

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({ status: 403, code: 'FORBIDDEN' });
  });

  it('rechaza con 403 al paciente archivado', async () => {
    mockFindFirst.mockResolvedValue({
      role: 'END_USER',
      patientAccount: { id: 'pac-1', estado: 'ARCHIVADO', deletedAt: null },
    });

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({ status: 403, code: 'FORBIDDEN' });
  });

  it('rechaza con 403 al paciente con borrado lógico', async () => {
    mockFindFirst.mockResolvedValue({
      role: 'END_USER',
      patientAccount: { id: 'pac-1', estado: 'ACTIVO', deletedAt: new Date() },
    });

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({ status: 403, code: 'FORBIDDEN' });
  });

  it('no distingue el motivo del rechazo entre roles y estados', async () => {
    mockFindFirst.mockResolvedValue({ role: 'NUTRITIONIST', patientAccount: null });
    const porRol = await requierePaciente();
    mockFindFirst.mockResolvedValue({
      role: 'END_USER',
      patientAccount: { id: 'pac-1', estado: 'ARCHIVADO', deletedAt: null },
    });
    const porEstado = await requierePaciente();

    if (porRol.ok || porEstado.ok) throw new Error('debían rechazar');
    await expect(porRol.respuesta.json()).resolves.toEqual(await porEstado.respuesta.json());
  });

  it('responde 500 si la base falla, sin dejar pasar la sesión', async () => {
    mockFindFirst.mockRejectedValue(new Error('conexión caída'));

    const resultado = await requierePaciente();

    if (resultado.ok) throw new Error('debía rechazar');
    expect(await estadoDe(resultado.respuesta)).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
