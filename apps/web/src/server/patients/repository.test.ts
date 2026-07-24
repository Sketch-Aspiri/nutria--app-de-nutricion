import type { SnapshotCalculo } from '@nutria/shared';

import { prisma } from '@/server/db';

import { actualizarExpedienteMedico, guardarCalculo } from './repository';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    medicalRecord: { upsert: jest.fn() },
    mealPlan: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DRAFT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64');

const db = prisma as unknown as {
  patient: { findFirst: jest.Mock };
  medicalRecord: { upsert: jest.Mock };
  mealPlan: {
    findFirst: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
};

const snapshot = {
  version: 1,
  resultado: {
    objetivoCalorias: 1_800,
    proteina_g: 120,
    carbos_g: 200,
    grasa_g: 60,
  },
} as unknown as SnapshotCalculo;

describe('persistencia del cálculo en planes', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY_ID = 'test';
    jest.clearAllMocks();
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
  });

  it('crea un borrador y nunca muta el plan activo histórico', async () => {
    db.mealPlan.findFirst.mockResolvedValue(null);
    db.mealPlan.create.mockResolvedValue({ id: DRAFT_ID, estado: 'BORRADOR' });

    await guardarCalculo(NUTRITIONIST_ID, PATIENT_ID, snapshot);

    expect(db.mealPlan.findFirst).toHaveBeenCalledWith({
      where: { patientId: PATIENT_ID, estado: 'BORRADOR' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(db.mealPlan.update).not.toHaveBeenCalled();
    expect(db.mealPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: PATIENT_ID,
        estado: 'BORRADOR',
        caloriasDiarias: 1_800,
      }),
    });
  });

  it('actualiza el borrador más reciente si ya existe', async () => {
    db.mealPlan.findFirst.mockResolvedValue({ id: DRAFT_ID, estado: 'BORRADOR' });
    db.mealPlan.update.mockResolvedValue({ id: DRAFT_ID, estado: 'BORRADOR' });

    await guardarCalculo(NUTRITIONIST_ID, PATIENT_ID, snapshot);

    expect(db.mealPlan.update).toHaveBeenCalledWith({
      where: { id: DRAFT_ID },
      data: expect.objectContaining({
        caloriasDiarias: 1_800,
        calculoSnapshot: snapshot,
      }),
    });
    expect(db.mealPlan.create).not.toHaveBeenCalled();
  });
});

describe('texto libre del objetivo en el expediente', () => {
  /** Devuelve el `update` que el repositorio le pasó a Prisma. */
  async function actualizarCon(
    datos: Parameters<typeof actualizarExpedienteMedico>[2],
    objetivoGuardado?: string,
  ) {
    db.patient.findFirst.mockResolvedValue({
      id: PATIENT_ID,
      medicalRecord: objetivoGuardado ? { objetivo: objetivoGuardado } : null,
    });
    db.medicalRecord.upsert.mockResolvedValue({ patientId: PATIENT_ID });

    await actualizarExpedienteMedico(NUTRITIONIST_ID, PATIENT_ID, datos);
    return db.medicalRecord.upsert.mock.calls[0][0].update;
  }

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY_ID = 'test';
    jest.clearAllMocks();
  });

  it('guarda la descripción cuando el objetivo es OTRO', async () => {
    const update = await actualizarCon({ objetivo: 'OTRO', objetivo_otro: 'Salud digestiva' });

    expect(update).toMatchObject({ objetivo: 'OTRO', objetivoOtro: 'Salud digestiva' });
  });

  it('descarta la descripción si el objetivo es uno del catálogo', async () => {
    const update = await actualizarCon({
      objetivo: 'MANTENIMIENTO',
      objetivo_otro: 'Salud digestiva',
    });

    expect(update).toMatchObject({ objetivo: 'MANTENIMIENTO', objetivoOtro: null });
  });

  it('limpia la descripción vieja al salir de OTRO aunque no la manden', async () => {
    const update = await actualizarCon({ objetivo: 'GANANCIA_MUSCULAR' }, 'OTRO');

    expect(update).toMatchObject({ objetivoOtro: null });
  });

  it('conserva el objetivo ya guardado al editar solo la descripción', async () => {
    const update = await actualizarCon({ objetivo_otro: 'Salud digestiva' }, 'OTRO');

    expect(update).toMatchObject({ objetivoOtro: 'Salud digestiva' });
    expect(update).not.toHaveProperty('objetivo');
  });

  it('no toca la descripción cuando la edición no menciona el objetivo', async () => {
    const update = await actualizarCon({ medicamentos: 'Metformina' }, 'OTRO');

    expect(update).not.toHaveProperty('objetivoOtro');
  });
});
