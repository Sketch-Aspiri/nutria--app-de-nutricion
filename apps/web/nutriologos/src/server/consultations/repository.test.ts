import { prisma } from '@/server/db';

import {
  createConsultationNote,
  signConsultationNote,
} from './repository';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    consultationNote: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOTE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const db = prisma as unknown as {
  patient: { findFirst: jest.Mock };
  consultationNote: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

const now = new Date('2026-07-24T15:00:00Z');
const note = {
  id: NOTE_ID,
  patientId: PATIENT_ID,
  fecha: now,
  motivo: 'Motivo',
  hallazgos: 'Hallazgos',
  plan: 'Plan',
  seguimiento: 'Seguimiento',
  transcripcionUrl: null,
  origen: 'MANUAL',
  firmadaAt: null,
  createdAt: now,
  updatedAt: now,
};

beforeEach(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  process.env.ENCRYPTION_KEY_ID = 'test';
  jest.clearAllMocks();
  db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
});

describe('notas clínicas', () => {
  it('cifra todos los textos antes de escribirlos', async () => {
    db.consultationNote.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...note,
        ...data,
      }),
    );

    const result = await createConsultationNote(
      NUTRITIONIST_ID,
      PATIENT_ID,
      {
        motivo: 'Motivo',
        hallazgos: 'Hallazgos',
        plan: 'Plan',
        seguimiento: 'Seguimiento',
        origen: 'MANUAL',
        firmar: false,
      },
    );

    const { data } = db.consultationNote.create.mock.calls[0][0] as {
      data: Record<string, string>;
    };
    expect(data.motivo).not.toBe('Motivo');
    expect(data.hallazgos).not.toBe('Hallazgos');
    expect(result?.motivo).toBe('Motivo');
  });

  it('firmar es idempotente y no reescribe el contenido', async () => {
    db.consultationNote.findFirst.mockResolvedValue({
      ...note,
      firmadaAt: now,
    });

    const result = await signConsultationNote(
      NUTRITIONIST_ID,
      PATIENT_ID,
      NOTE_ID,
    );

    expect(result?.firmadaAt).toEqual(now);
    expect(db.consultationNote.update).not.toHaveBeenCalled();
  });
});
