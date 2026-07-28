import { prisma } from '@/server/db';

import {
  actualizarCita,
  cerrarCita,
  CitaEmpalmadaError,
  CitaNoEditableError,
  crearCita,
  eliminarCita,
} from './repository';
import { actualizarCitaSchema, crearCitaSchema } from './schemas';

jest.mock('@/server/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    patient: { findFirst: jest.fn() },
    appointment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTRO_NUTRIOLOGO = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CITA_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type MetodoMock = jest.Mock<Promise<unknown>, unknown[]>;
type PrismaMock = {
  $queryRaw: MetodoMock;
  patient: { findFirst: MetodoMock };
  appointment: {
    findFirst: MetodoMock;
    findMany: MetodoMock;
    count: MetodoMock;
    create: MetodoMock;
    updateMany: MetodoMock;
    deleteMany: MetodoMock;
  };
};

const db = prisma as unknown as PrismaMock;

function cita(overrides: Record<string, unknown> = {}) {
  return {
    id: CITA_ID,
    nutritionistId: NUTRITIONIST_ID,
    patientId: PATIENT_ID,
    inicio: new Date('2026-08-01T15:00:00Z'),
    duracionMin: 45,
    tipo: 'PRESENCIAL',
    estado: 'PROGRAMADA',
    notas: null,
    videoUrl: null,
    recordatorioEnviadoAt: null,
    createdAt: new Date('2026-07-23T00:00:00Z'),
    updatedAt: new Date('2026-07-23T00:00:00Z'),
    patient: { id: PATIENT_ID, nombre: 'Paciente de prueba', fotoUrl: null, email: null },
    ...overrides,
  };
}

const datosCrear = crearCitaSchema.parse({
  patient_id: PATIENT_ID,
  inicio: '2026-08-01T09:00:00-06:00',
  duracion_min: 45,
});

beforeEach(() => {
  jest.clearAllMocks();
  db.$queryRaw.mockResolvedValue([]);
});

describe('crearCita', () => {
  it('agenda la cita cuando el paciente es del nutriólogo', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.appointment.create.mockResolvedValue(cita());

    const creada = await crearCita(NUTRITIONIST_ID, datosCrear);

    expect(creada).toMatchObject({ id: CITA_ID });
    // El paciente se busca filtrando por nutriólogo dentro de la misma consulta.
    expect(db.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PATIENT_ID, nutritionistId: NUTRITIONIST_ID, deletedAt: null },
      }),
    );
  });

  it('devuelve null si el paciente es de otro nutriólogo', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    expect(await crearCita(OTRO_NUTRIOLOGO, datosCrear)).toBeNull();
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it('rechaza una cita que se traslapa con otra', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.$queryRaw.mockResolvedValue([{ id: 'otra-cita' }]);

    await expect(crearCita(NUTRITIONIST_ID, datosCrear)).rejects.toBeInstanceOf(
      CitaEmpalmadaError,
    );
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it('no consulta la base si el id de paciente no es un UUID', async () => {
    expect(await crearCita(NUTRITIONIST_ID, { ...datosCrear, patient_id: 'no-es-uuid' })).toBeNull();
    expect(db.patient.findFirst).not.toHaveBeenCalled();
  });
});

describe('actualizarCita', () => {
  it('reprograma la cita y devuelve el recordatorio a la cola', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    db.appointment.updateMany.mockResolvedValue({ count: 1 });

    await actualizarCita(
      NUTRITIONIST_ID,
      CITA_ID,
      actualizarCitaSchema.parse({ inicio: '2026-08-02T10:00:00-06:00' }),
    );

    // Mover la cita invalida el correo ya enviado: el paciente tiene una hora
    // que dejó de ser cierta.
    expect(db.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CITA_ID, nutritionistId: NUTRITIONIST_ID },
        data: expect.objectContaining({ recordatorioEnviadoAt: null }),
      }),
    );
  });

  it('no toca el recordatorio cuando solo cambian las notas', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    db.appointment.updateMany.mockResolvedValue({ count: 1 });

    await actualizarCita(
      NUTRITIONIST_ID,
      CITA_ID,
      actualizarCitaSchema.parse({ notas: 'Trae estudios de laboratorio' }),
    );

    const { data } = db.appointment.updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).not.toHaveProperty('recordatorioEnviadoAt');
  });

  it('devuelve null cuando la cita es de otro nutriólogo', async () => {
    db.appointment.findFirst.mockResolvedValue(null);

    expect(
      await actualizarCita(OTRO_NUTRIOLOGO, CITA_ID, actualizarCitaSchema.parse({ notas: 'x' })),
    ).toBeNull();
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('no revisa empalmes al cancelar: una cita cancelada libera el horario', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    db.appointment.updateMany.mockResolvedValue({ count: 1 });

    await actualizarCita(
      NUTRITIONIST_ID,
      CITA_ID,
      actualizarCitaSchema.parse({ estado: 'CANCELADA' }),
    );

    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('cerrarCita', () => {
  it('completa una cita programada', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    db.appointment.updateMany.mockResolvedValue({ count: 1 });

    await cerrarCita(NUTRITIONIST_ID, CITA_ID, 'COMPLETADA');

    expect(db.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CITA_ID, nutritionistId: NUTRITIONIST_ID, estado: 'PROGRAMADA' },
      }),
    );
  });

  it('al cancelar bloquea el recordatorio para que no salga el correo', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    db.appointment.updateMany.mockResolvedValue({ count: 1 });

    await cerrarCita(NUTRITIONIST_ID, CITA_ID, 'CANCELADA');

    const { data } = db.appointment.updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.recordatorioEnviadoAt).toBeInstanceOf(Date);
  });

  it('rechaza cerrar una cita que ya estaba cerrada', async () => {
    db.appointment.findFirst.mockResolvedValue(cita({ estado: 'COMPLETADA' }));

    await expect(cerrarCita(NUTRITIONIST_ID, CITA_ID, 'CANCELADA')).rejects.toBeInstanceOf(
      CitaNoEditableError,
    );
    expect(db.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('trata como no editable la carrera con otra pestaña', async () => {
    db.appointment.findFirst.mockResolvedValue(cita());
    // Entre la lectura y la escritura, otra sesión ya la cerró.
    db.appointment.updateMany.mockResolvedValue({ count: 0 });

    await expect(cerrarCita(NUTRITIONIST_ID, CITA_ID, 'COMPLETADA')).rejects.toBeInstanceOf(
      CitaNoEditableError,
    );
  });

  it('devuelve null cuando la cita no es del nutriólogo', async () => {
    db.appointment.findFirst.mockResolvedValue(null);

    expect(await cerrarCita(OTRO_NUTRIOLOGO, CITA_ID, 'COMPLETADA')).toBeNull();
  });
});

describe('eliminarCita', () => {
  it('borra solo dentro del propio consultorio', async () => {
    db.appointment.deleteMany.mockResolvedValue({ count: 1 });

    expect(await eliminarCita(NUTRITIONIST_ID, CITA_ID)).toBe(true);
    expect(db.appointment.deleteMany).toHaveBeenCalledWith({
      where: { id: CITA_ID, nutritionistId: NUTRITIONIST_ID },
    });
  });

  it('devuelve false cuando no borró nada', async () => {
    db.appointment.deleteMany.mockResolvedValue({ count: 0 });

    expect(await eliminarCita(OTRO_NUTRIOLOGO, CITA_ID)).toBe(false);
  });
});
