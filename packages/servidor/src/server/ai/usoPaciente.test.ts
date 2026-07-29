/**
 * @jest-environment node
 */
import { LIMITE_INTERACCIONES_IA_PACIENTE } from '@nutria/shared';

import { prisma } from '@/server/db';

import {
  consultarCuotaPaciente,
  devolverInteraccion,
  devolverInteraccionCompleta,
  nutriologoDelPaciente,
  reservarInteraccion,
} from './usoPaciente';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    aiUsage: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
  },
}));

const mockReservarGeneracion = jest.fn();
const mockDevolverGeneracion = jest.fn();

jest.mock('./uso', () => ({
  reservarGeneracion: (...args: unknown[]) => mockReservarGeneracion(...args),
  devolverGeneracion: (...args: unknown[]) => mockDevolverGeneracion(...args),
}));

const mockPrisma = prisma as unknown as {
  patient: { findFirst: jest.Mock };
  aiUsage: { findUnique: jest.Mock; upsert: jest.Mock; updateMany: jest.Mock };
};

const PACIENTE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const USER_ID = 'a1b2c3d4-0000-4000-8000-000000000002';
const NUTRIOLOGO_ID = 'a1b2c3d4-0000-4000-8000-000000000003';
const AHORA = new Date('2026-07-29T12:00:00Z');
const MES = '2026-07';

const CUOTA_CLINICA_LIBRE = {
  plan: 'PRO' as const,
  limite: 150,
  usadas: 3,
  restantes: 147,
  agotada: false,
  ilimitada: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.aiUsage.updateMany.mockResolvedValue({ count: 1 });
  mockDevolverGeneracion.mockResolvedValue(undefined);
  mockReservarGeneracion.mockResolvedValue({ permitida: true, cuota: CUOTA_CLINICA_LIBRE });
});

describe('nutriologoDelPaciente', () => {
  it('devuelve el usuario dueño del expediente', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ nutritionistId: NUTRIOLOGO_ID });

    await expect(nutriologoDelPaciente(PACIENTE_ID)).resolves.toBe(NUTRIOLOGO_ID);
  });

  it('ignora expedientes borrados', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(nutriologoDelPaciente(PACIENTE_ID)).resolves.toBeNull();
    expect(mockPrisma.patient.findFirst.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
  });
});

describe('consultarCuotaPaciente', () => {
  it('parte de cero cuando el paciente no tiene fila del mes', async () => {
    mockPrisma.aiUsage.findUnique.mockResolvedValue(null);

    await expect(consultarCuotaPaciente(USER_ID, AHORA)).resolves.toMatchObject({
      usadas: 0,
      restantes: LIMITE_INTERACCIONES_IA_PACIENTE,
      agotada: false,
    });
  });

  it('no modifica el contador al consultarlo', async () => {
    mockPrisma.aiUsage.findUnique.mockResolvedValue({ generaciones: 12 });

    await consultarCuotaPaciente(USER_ID, AHORA);

    expect(mockPrisma.aiUsage.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.aiUsage.updateMany).not.toHaveBeenCalled();
  });
});

describe('reservarInteraccion', () => {
  it('cobra al paciente y a la clínica cuando ambos topes alcanzan', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 5 });

    const reserva = await reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(reserva).toMatchObject({
      ok: true,
      cuotas: { paciente: { usadas: 5 }, clinica: CUOTA_CLINICA_LIBRE },
    });
    expect(mockReservarGeneracion).toHaveBeenCalledWith(NUTRIOLOGO_ID, AHORA);
  });

  it('incrementa antes de comprobar, en una sola sentencia atómica', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 1 });

    await reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(mockPrisma.aiUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_mes: { userId: USER_ID, mes: MES } },
        update: { generaciones: { increment: 1 } },
      }),
    );
  });

  it('rechaza y reembolsa cuando el paciente se pasa de su tope', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({
      generaciones: LIMITE_INTERACCIONES_IA_PACIENTE + 1,
    });

    const reserva = await reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(reserva).toMatchObject({ ok: false, motivo: 'paciente' });
    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { generaciones: { decrement: 1 } } }),
    );
  });

  it('no toca la cuota de la clínica si el paciente ya se pasó', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({
      generaciones: LIMITE_INTERACCIONES_IA_PACIENTE + 1,
    });

    await reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(mockReservarGeneracion).not.toHaveBeenCalled();
  });

  it('permite la última interacción del tope, no la siguiente', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({
      generaciones: LIMITE_INTERACCIONES_IA_PACIENTE,
    });

    await expect(reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA)).resolves.toMatchObject({
      ok: true,
    });
  });

  it('devuelve la interacción del paciente si la clínica agotó su cuota', async () => {
    mockPrisma.aiUsage.upsert.mockResolvedValue({ generaciones: 2 });
    const agotada = { ...CUOTA_CLINICA_LIBRE, restantes: 0, agotada: true };
    mockReservarGeneracion.mockResolvedValue({ permitida: false, cuota: agotada });

    const reserva = await reservarInteraccion(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(reserva).toMatchObject({ ok: false, motivo: 'clinica', cuota: agotada });
    // No se le cobra al paciente una interacción que nunca ocurrió.
    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('devolución de reservas', () => {
  it('nunca deja el contador del paciente en negativo', async () => {
    await devolverInteraccion(USER_ID, AHORA);

    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, mes: MES, generaciones: { gt: 0 } },
      }),
    );
  });

  it('deshace las dos reservas juntas', async () => {
    await devolverInteraccionCompleta(USER_ID, NUTRIOLOGO_ID, AHORA);

    expect(mockPrisma.aiUsage.updateMany).toHaveBeenCalledTimes(1);
    expect(mockDevolverGeneracion).toHaveBeenCalledWith(NUTRIOLOGO_ID, AHORA);
  });
});
