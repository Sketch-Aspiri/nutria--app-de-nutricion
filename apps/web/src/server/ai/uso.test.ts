/**
 * @jest-environment node
 */
import { prisma } from '@/server/db';

import {
  consultarCuota,
  devolverGeneracion,
  planDelUsuario,
  registrarTokens,
  reservarGeneracion,
} from './uso';

jest.mock('@/server/db', () => ({
  prisma: {
    subscription: { findUnique: jest.fn() },
    aiUsage: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  subscription: { findUnique: jest.Mock };
  aiUsage: { findUnique: jest.Mock; upsert: jest.Mock; updateMany: jest.Mock };
};

const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const AHORA = new Date('2026-07-23T12:00:00Z');
const MES = '2026-07';

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiUsage.updateMany.mockResolvedValue({ count: 1 });
  // Estas pruebas describen el racionamiento, que solo existe fuera de la beta
  // comercial. El modo se fija explícitamente para no depender del default.
  process.env.BILLING_MODE = 'produccion';
});

afterAll(() => {
  delete process.env.BILLING_MODE;
});

describe('planDelUsuario', () => {
  it('devuelve FREE cuando el usuario no tiene suscripción', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(planDelUsuario(USER_ID)).resolves.toBe('FREE');
  });

  it('devuelve el plan de una suscripción activa', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'ACTIVE' });

    await expect(planDelUsuario(USER_ID)).resolves.toBe('PRO');
  });

  it('respeta el plan durante el periodo de prueba', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'PRO', status: 'TRIALING' });

    await expect(planDelUsuario(USER_ID)).resolves.toBe('PRO');
  });

  it('degrada a FREE una suscripción cancelada', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'CLINICA', status: 'CANCELED' });

    await expect(planDelUsuario(USER_ID)).resolves.toBe('FREE');
  });
});

describe('consultarCuota', () => {
  it('no modifica el contador al consultarlo', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE' });
    mockPrisma.aiUsage.findUnique.mockResolvedValue({ generaciones: 4 });

    const cuota = await consultarCuota(USER_ID, AHORA);

    expect(cuota).toMatchObject({ plan: 'FREE', limite: 15, usadas: 4, restantes: 11 });
    expect(mockPrisma.aiUsage.upsert).not.toHaveBeenCalled();
  });

  it('trata la ausencia de registro del mes como cero consumido', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.aiUsage.findUnique.mockResolvedValue(null);

    await expect(consultarCuota(USER_ID, AHORA)).resolves.toMatchObject({
      usadas: 0,
      restantes: 15,
      agotada: false,
    });
  });
});

describe('reservarGeneracion', () => {
  it('incrementa el contador del mes en una sola sentencia atómica', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE' });
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 1 });

    const resultado = await reservarGeneracion(USER_ID, AHORA);

    expect(resultado.permitida).toBe(true);
    expect(mockPrisma.aiUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_mes: { userId: USER_ID, mes: MES } },
        create: { userId: USER_ID, mes: MES, generaciones: 1 },
        update: { generaciones: { increment: 1 } },
      }),
    );
  });

  it('permite la última generación del límite', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE' });
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 15 });

    await expect(reservarGeneracion(USER_ID, AHORA)).resolves.toMatchObject({
      permitida: true,
      cuota: { restantes: 0, agotada: true },
    });
  });

  it('rechaza y reembolsa cuando la reserva pasa del límite', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE' });
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 16 });

    const resultado = await reservarGeneracion(USER_ID, AHORA);

    expect(resultado.permitida).toBe(false);
    expect(resultado.cuota.agotada).toBe(true);
    // El incremento se deshace para que el contador no crezca sin límite.
    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { generaciones: { decrement: 1 } } }),
    );
  });

  it('aplica el límite del plan contratado', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'CLINICA', status: 'ACTIVE' });
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 200 });

    await expect(reservarGeneracion(USER_ID, AHORA)).resolves.toMatchObject({
      permitida: true,
      cuota: { limite: 500, restantes: 300 },
    });
  });

  it('en la beta comercial cuenta el consumo pero no rechaza a nadie', async () => {
    process.env.BILLING_MODE = 'beta';
    mockPrisma.subscription.findUnique.mockResolvedValue({ plan: 'FREE', status: 'ACTIVE' });
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 900 });

    const resultado = await reservarGeneracion(USER_ID, AHORA);

    expect(resultado).toMatchObject({
      permitida: true,
      cuota: { limite: null, ilimitada: true, agotada: false, usadas: 900 },
    });
    // El consumo se sigue registrando: sirve para dimensionar el costo real.
    expect(mockPrisma.aiUsage.upsert).toHaveBeenCalled();
    expect(mockPrisma.aiUsage.updateMany).not.toHaveBeenCalled();
  });
});

describe('devolverGeneracion', () => {
  it('nunca deja el contador en negativo', async () => {
    await devolverGeneracion(USER_ID, AHORA);

    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, mes: MES, generaciones: { gt: 0 } },
      data: { generaciones: { decrement: 1 } },
    });
  });
});

describe('registrarTokens', () => {
  it('acumula los tokens de entrada y salida del mes', async () => {
    await registrarTokens(USER_ID, { entrada: 3_000, salida: 1_500 }, AHORA);

    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, mes: MES },
      data: {
        tokensEntrada: { increment: 3_000 },
        tokensSalida: { increment: 1_500 },
      },
    });
  });
});
