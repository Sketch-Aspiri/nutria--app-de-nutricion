import type { SnapshotCalculo } from '@nutria/shared';

import { prisma } from '@/server/db';

import { guardarCalculo } from './repository';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
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

const db = prisma as unknown as {
  patient: { findFirst: jest.Mock };
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
