import { prisma } from '@/server/db';
import { enviarRecordatorioCita } from '@/server/email';

import { enviarRecordatoriosPendientes, HORAS_ANTICIPACION } from './recordatorios';

jest.mock('@/server/db', () => ({
  prisma: {
    appointment: { findMany: jest.fn(), updateMany: jest.fn() },
  },
}));
jest.mock('@/server/email', () => ({ enviarRecordatorioCita: jest.fn() }));

type MetodoMock = jest.Mock<Promise<unknown>, unknown[]>;
const db = prisma as unknown as {
  appointment: { findMany: MetodoMock; updateMany: MetodoMock };
};
const enviar = enviarRecordatorioCita as unknown as MetodoMock;

const AHORA = new Date('2026-07-23T12:00:00Z');

function citaPendiente(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cita-1',
    inicio: new Date('2026-07-24T02:00:00Z'),
    tipo: 'PRESENCIAL',
    videoUrl: null,
    patient: { nombre: 'Paciente de prueba', email: 'paciente@ejemplo.test' },
    nutritionist: {
      nutritionistProfile: {
        nombreCompleto: 'Nutrióloga de prueba',
        marcaNombre: 'Consultorio Verde',
        zonaHoraria: 'America/Mexico_City',
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  db.appointment.updateMany.mockResolvedValue({ count: 1 });
  enviar.mockResolvedValue({ enviado: true });
});

describe('enviarRecordatoriosPendientes', () => {
  it('solo considera citas programadas, futuras y aún no recordadas', async () => {
    db.appointment.findMany.mockResolvedValue([]);

    await enviarRecordatoriosPendientes(AHORA);

    const { where } = db.appointment.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(where).toMatchObject({ estado: 'PROGRAMADA', recordatorioEnviadoAt: null });
    // Una cita que ya pasó no se recuerda: el aviso llegaría tarde.
    expect(where.inicio).toEqual({
      gte: AHORA,
      lte: new Date(AHORA.getTime() + HORAS_ANTICIPACION * 3_600_000),
    });
  });

  it('envía el recordatorio y lo cuenta', async () => {
    db.appointment.findMany.mockResolvedValue([citaPendiente()]);

    const resultado = await enviarRecordatoriosPendientes(AHORA);

    expect(resultado).toMatchObject({ candidatas: 1, enviados: 1, fallidos: 0, sinCorreo: 0 });
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        para: 'paciente@ejemplo.test',
        consultorio: 'Consultorio Verde',
      }),
    );
  });

  it('formatea la hora en la zona del consultorio, no en UTC', async () => {
    db.appointment.findMany.mockResolvedValue([citaPendiente()]);

    await enviarRecordatoriosPendientes(AHORA);

    // 02:00 UTC del día 24 son las 20:00 del 23 en Ciudad de México.
    const { cuando } = enviar.mock.calls[0]![0] as { cuando: string };
    expect(cuando).toContain('23');
    expect(cuando).toContain('julio');
  });

  it('reserva el envío antes de llamar al proveedor', async () => {
    db.appointment.findMany.mockResolvedValue([citaPendiente()]);
    const orden: string[] = [];
    db.appointment.updateMany.mockImplementation(async () => {
      orden.push('reserva');
      return { count: 1 };
    });
    enviar.mockImplementation(async () => {
      orden.push('envio');
      return { enviado: true };
    });

    await enviarRecordatoriosPendientes(AHORA);

    // Marcar después dejaría que un timeout tras un envío exitoso reenviara el
    // mismo correo cada 15 minutos.
    expect(orden).toEqual(['reserva', 'envio']);
  });

  it('no envía dos veces si otra corrida ya reservó la cita', async () => {
    db.appointment.findMany.mockResolvedValue([citaPendiente()]);
    db.appointment.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await enviarRecordatoriosPendientes(AHORA);

    expect(enviar).not.toHaveBeenCalled();
    expect(resultado.enviados).toBe(0);
  });

  it('devuelve la cita a la cola cuando el proveedor falla', async () => {
    db.appointment.findMany.mockResolvedValue([citaPendiente()]);
    enviar.mockResolvedValue({ enviado: false, motivo: 'error_proveedor' });

    const resultado = await enviarRecordatoriosPendientes(AHORA);

    expect(resultado.fallidos).toBe(1);
    // La última escritura devuelve el marcador a null para reintentar.
    const ultima = db.appointment.updateMany.mock.calls.at(-1)![0] as {
      data: Record<string, unknown>;
    };
    expect(ultima.data).toEqual({ recordatorioEnviadoAt: null });
  });

  it('marca como atendida la cita de un paciente sin correo, sin intentar enviar', async () => {
    db.appointment.findMany.mockResolvedValue([
      citaPendiente({ patient: { nombre: 'Sin correo', email: null } }),
    ]);

    const resultado = await enviarRecordatoriosPendientes(AHORA);

    expect(enviar).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ sinCorreo: 1, enviados: 0 });
    // Se marca para no reevaluarla cada cuarto de hora hasta que la cita ocurra.
    expect(db.appointment.updateMany).toHaveBeenCalled();
  });

  it('usa el nombre del profesional cuando no hay marca configurada', async () => {
    db.appointment.findMany.mockResolvedValue([
      citaPendiente({
        nutritionist: {
          nutritionistProfile: {
            nombreCompleto: 'Nutrióloga de prueba',
            marcaNombre: null,
            zonaHoraria: 'America/Mexico_City',
          },
        },
      }),
    ]);

    await enviarRecordatoriosPendientes(AHORA);

    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ consultorio: 'Nutrióloga de prueba' }),
    );
  });
});
