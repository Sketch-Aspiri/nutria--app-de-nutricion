import { prisma } from '@/server/db';

import {
  enviarMensaje,
  listarConversaciones,
  listarHilo,
  marcarHiloLeido,
} from './repository';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn(), findMany: jest.fn() },
    message: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTRO_NUTRIOLOGO = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MENSAJE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type MetodoMock = jest.Mock<Promise<unknown>, unknown[]>;
const db = prisma as unknown as {
  patient: { findFirst: MetodoMock; findMany: MetodoMock };
  message: {
    findFirst: MetodoMock;
    findMany: MetodoMock;
    count: MetodoMock;
    create: MetodoMock;
    updateMany: MetodoMock;
    groupBy: MetodoMock;
  };
};

const PAGINACION = { skip: 0, take: 50 };

beforeEach(() => {
  jest.clearAllMocks();
  db.message.findMany.mockResolvedValue([]);
  db.message.count.mockResolvedValue(0);
});

describe('listarHilo', () => {
  it('devuelve null cuando el paciente es de otro nutriólogo', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    expect(await listarHilo(OTRO_NUTRIOLOGO, PATIENT_ID, PAGINACION, {})).toBeNull();
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it('filtra siempre por nutriólogo y paciente', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });

    await listarHilo(NUTRITIONIST_ID, PATIENT_ID, PAGINACION, {});

    expect(db.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: PATIENT_ID, nutritionistId: NUTRITIONIST_ID },
      }),
    );
  });

  it('con desde_id trae solo lo posterior a ese mensaje', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    const ancla = new Date('2026-07-23T10:00:00Z');
    db.message.findFirst.mockResolvedValue({ createdAt: ancla });

    await listarHilo(NUTRITIONIST_ID, PATIENT_ID, PAGINACION, { desde_id: MENSAJE_ID });

    expect(db.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gt: ancla } }),
      }),
    );
  });

  it('devuelve el hilo completo si el ancla ya no existe, en vez de un vacío engañoso', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.message.findFirst.mockResolvedValue(null);

    await listarHilo(NUTRITIONIST_ID, PATIENT_ID, PAGINACION, { desde_id: MENSAJE_ID });

    const { where } = db.message.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(where).not.toHaveProperty('createdAt');
  });
});

describe('enviarMensaje', () => {
  it('fija el emisor desde la sesión, no desde el cuerpo', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.message.create.mockResolvedValue({ id: MENSAJE_ID });

    await enviarMensaje(NUTRITIONIST_ID, PATIENT_ID, { texto: 'Nos vemos el jueves' });

    const { data } = db.message.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    // Aceptar el emisor del cliente dejaría al nutriólogo escribir mensajes en
    // nombre del paciente.
    expect(data.emisor).toBe('NUTRITIONIST');
    expect(data.leidoAt).toBeInstanceOf(Date);
  });

  it('devuelve null para un paciente ajeno', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    expect(await enviarMensaje(OTRO_NUTRIOLOGO, PATIENT_ID, { texto: 'hola' })).toBeNull();
    expect(db.message.create).not.toHaveBeenCalled();
  });
});

describe('marcarHiloLeido', () => {
  it('solo marca los mensajes del paciente que siguen sin leer', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.message.updateMany.mockResolvedValue({ count: 3 });

    expect(await marcarHiloLeido(NUTRITIONIST_ID, PATIENT_ID)).toBe(3);
    expect(db.message.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nutritionistId: NUTRITIONIST_ID,
          patientId: PATIENT_ID,
          emisor: 'PATIENT',
          leidoAt: null,
        },
      }),
    );
  });

  it('devuelve null para un paciente ajeno', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    expect(await marcarHiloLeido(OTRO_NUTRIOLOGO, PATIENT_ID)).toBeNull();
  });
});

describe('listarConversaciones', () => {
  const conMensaje = (id: string, nombre: string, cuando: string) => ({
    id,
    nombre,
    fotoUrl: null,
    messages: [{ texto: 'hola', emisor: 'PATIENT', createdAt: new Date(cuando) }],
  });

  it('ordena por conversación más reciente y deja al final a quien no tiene mensajes', async () => {
    db.patient.findMany.mockResolvedValue([
      { id: 'p-3', nombre: 'Ana', fotoUrl: null, messages: [] },
      conMensaje('p-1', 'Beto', '2026-07-20T10:00:00Z'),
      conMensaje('p-2', 'Carla', '2026-07-23T10:00:00Z'),
    ]);
    db.message.groupBy.mockResolvedValue([]);

    const conversaciones = await listarConversaciones(NUTRITIONIST_ID);

    expect(conversaciones.map((c) => c.patientId)).toEqual(['p-2', 'p-1', 'p-3']);
  });

  it('adjunta los pendientes por leer de cada hilo', async () => {
    db.patient.findMany.mockResolvedValue([conMensaje('p-1', 'Beto', '2026-07-23T10:00:00Z')]);
    db.message.groupBy.mockResolvedValue([{ patientId: 'p-1', _count: { _all: 4 } }]);

    const [conversacion] = await listarConversaciones(NUTRITIONIST_ID);

    expect(conversacion).toMatchObject({ patientId: 'p-1', sinLeer: 4 });
  });

  it('incluye pacientes sin mensajes: la bandeja también sirve para iniciar', async () => {
    db.patient.findMany.mockResolvedValue([
      { id: 'p-1', nombre: 'Ana', fotoUrl: null, messages: [] },
    ]);
    db.message.groupBy.mockResolvedValue([]);

    const [conversacion] = await listarConversaciones(NUTRITIONIST_ID);

    expect(conversacion).toMatchObject({ ultimoAt: null, sinLeer: 0 });
  });

  it('pide solo los pacientes activos del nutriólogo', async () => {
    db.patient.findMany.mockResolvedValue([]);
    db.message.groupBy.mockResolvedValue([]);

    await listarConversaciones(NUTRITIONIST_ID);

    expect(db.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nutritionistId: NUTRITIONIST_ID, deletedAt: null, estado: 'ACTIVO' },
      }),
    );
  });
});
