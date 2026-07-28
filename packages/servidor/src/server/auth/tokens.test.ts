/**
 * @jest-environment node
 */
import { consumirTokenVerificacion, generarToken, hashToken } from './tokens';

const mockFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockTokenUpdate = jest.fn();
const mockUserUpdate = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    emailVerificationToken: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockTokenUpdate(...args),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const EN_UNA_HORA = () => new Date(Date.now() + 60 * 60 * 1000);
const HACE_UNA_HORA = () => new Date(Date.now() - 60 * 60 * 1000);

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction.mockResolvedValue([]);
});

describe('generarToken', () => {
  it('emite tokens distintos en cada llamada', () => {
    const a = generarToken();
    const b = generarToken();

    expect(a.token).not.toBe(b.token);
  });

  it('devuelve el hash correspondiente al token', () => {
    const { token, tokenHash } = generarToken();

    expect(tokenHash).toBe(hashToken(token));
  });

  it('no incluye el token en claro dentro del hash', () => {
    const { token, tokenHash } = generarToken();

    expect(tokenHash).not.toContain(token);
  });

  it('genera tokens seguros para usar en una URL', () => {
    expect(generarToken().token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('consumirTokenVerificacion', () => {
  it('marca el correo como verificado con un token válido', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: EN_UNA_HORA(),
    });

    const resultado = await consumirTokenVerificacion('token-de-prueba');

    expect(resultado).toEqual({ ok: true, userId: 'user-1' });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('busca por el hash, nunca por el token en claro', async () => {
    mockFindUnique.mockResolvedValue(null);

    await consumirTokenVerificacion('token-de-prueba');

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('token-de-prueba') },
    });
  });

  it('rechaza un token inexistente', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(consumirTokenVerificacion('inventado')).resolves.toEqual({
      ok: false,
      motivo: 'invalido',
    });
  });

  it('rechaza un token ya usado sin volver a verificar al usuario', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      usedAt: new Date(),
      expiresAt: EN_UNA_HORA(),
    });

    await expect(consumirTokenVerificacion('reusado')).resolves.toEqual({
      ok: false,
      motivo: 'invalido',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('distingue un token vencido para poder ofrecer reenvío', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'tok-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: HACE_UNA_HORA(),
    });

    await expect(consumirTokenVerificacion('vencido')).resolves.toEqual({
      ok: false,
      motivo: 'expirado',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
