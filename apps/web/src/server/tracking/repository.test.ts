import { prisma } from '@/server/db';

import {
  comentarComida,
  guardarPlanActividad,
  registrarComida,
  registrarPeso,
  resumenDeSeguimiento,
} from './repository';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    nutritionistProfile: { findUnique: jest.fn() },
    mealPlan: { findFirst: jest.fn() },
    mealPlanMeal: { findFirst: jest.fn() },
    mealLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    weightLog: { findMany: jest.fn(), upsert: jest.fn() },
    exerciseLog: { findMany: jest.fn(), create: jest.fn() },
    activityPlan: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTRO_NUTRIOLOGO = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMIDA_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const COMIDA_PLAN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

type MetodoMock = jest.Mock<Promise<unknown>, unknown[]>;
const db = prisma as unknown as {
  patient: { findFirst: MetodoMock };
  nutritionistProfile: { findUnique: MetodoMock };
  mealPlan: { findFirst: MetodoMock };
  mealPlanMeal: { findFirst: MetodoMock };
  mealLog: {
    findMany: MetodoMock;
    count: MetodoMock;
    create: MetodoMock;
    updateMany: MetodoMock;
    findUniqueOrThrow: MetodoMock;
  };
  weightLog: { findMany: MetodoMock; upsert: MetodoMock };
  exerciseLog: { findMany: MetodoMock; create: MetodoMock };
  activityPlan: { findFirst: MetodoMock; create: MetodoMock; updateMany: MetodoMock };
};

beforeEach(() => {
  jest.clearAllMocks();
  db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
  db.nutritionistProfile.findUnique.mockResolvedValue({ zonaHoraria: 'America/Mexico_City' });
  db.mealLog.findMany.mockResolvedValue([]);
  db.weightLog.findMany.mockResolvedValue([]);
});

describe('registrarComida', () => {
  it('rechaza ligar la comida a un plan de otro paciente', async () => {
    // El id existe, pero pertenece al plan de alguien más.
    db.mealPlanMeal.findFirst.mockResolvedValue(null);

    const resultado = await registrarComida(NUTRITIONIST_ID, PATIENT_ID, {
      fecha: new Date('2026-07-23T14:00:00Z'),
      nombre: 'Comida',
      meal_plan_meal_id: COMIDA_PLAN_ID,
    });

    expect(resultado).toBeNull();
    expect(db.mealLog.create).not.toHaveBeenCalled();
  });

  it('registra la comida ligada cuando la comida del plan sí es del paciente', async () => {
    db.mealPlanMeal.findFirst.mockResolvedValue({ id: COMIDA_PLAN_ID });
    db.mealLog.create.mockResolvedValue({ id: COMIDA_ID });

    const resultado = await registrarComida(NUTRITIONIST_ID, PATIENT_ID, {
      fecha: new Date('2026-07-23T14:00:00Z'),
      nombre: 'Comida',
      meal_plan_meal_id: COMIDA_PLAN_ID,
    });

    expect(resultado?.comida).toMatchObject({ id: COMIDA_ID });
  });

  it('devuelve null para un paciente ajeno', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    const resultado = await registrarComida(OTRO_NUTRIOLOGO, PATIENT_ID, {
      fecha: new Date(),
      nombre: 'Comida',
    });

    expect(resultado).toBeNull();
  });
});

describe('comentarComida', () => {
  it('escribe solo el comentario del nutriólogo', async () => {
    db.mealLog.updateMany.mockResolvedValue({ count: 1 });
    db.mealLog.findUniqueOrThrow.mockResolvedValue({ id: COMIDA_ID });

    await comentarComida(NUTRITIONIST_ID, COMIDA_ID, { comentario_nutriologo: 'Buena elección' });

    expect(db.mealLog.updateMany).toHaveBeenCalledWith({
      // El filtro de autorización viaja dentro de la propia escritura.
      where: { id: COMIDA_ID, patient: { nutritionistId: NUTRITIONIST_ID, deletedAt: null } },
      data: { comentarioNutriologo: 'Buena elección' },
    });
  });

  it('devuelve null cuando la comida es de un paciente ajeno', async () => {
    db.mealLog.updateMany.mockResolvedValue({ count: 0 });

    expect(
      await comentarComida(OTRO_NUTRIOLOGO, COMIDA_ID, { comentario_nutriologo: 'hola' }),
    ).toBeNull();
  });
});

describe('registrarPeso', () => {
  it('corrige la lectura del día en vez de duplicar el punto de la gráfica', async () => {
    db.weightLog.upsert.mockResolvedValue({ id: 'peso-1' });

    await registrarPeso(NUTRITIONIST_ID, PATIENT_ID, { fecha: '2026-07-23', peso_kg: 78.4 });

    expect(db.weightLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId_fecha: { patientId: PATIENT_ID, fecha: new Date('2026-07-23T00:00:00Z') } },
        update: { pesoKg: 78.4 },
      }),
    );
  });
});

describe('resumenDeSeguimiento', () => {
  it('sin plan activo devuelve adherencia null, no 0%', async () => {
    db.mealPlan.findFirst.mockResolvedValue(null);

    const resumen = await resumenDeSeguimiento(NUTRITIONIST_ID, PATIENT_ID, { dias: 7 });

    // Un 0 % se leería en el panel como abandono del paciente, cuando lo que
    // falta es el plan.
    expect(resumen).toMatchObject({ adherencia: null, comidasPorDia: null, dias: [] });
  });

  it('trata un plan sin comidas como si no hubiera plan', async () => {
    db.mealPlan.findFirst.mockResolvedValue({
      activadoAt: new Date('2026-07-20T00:00:00Z'),
      createdAt: new Date('2026-07-19T00:00:00Z'),
      _count: { meals: 0 },
    });

    const resumen = await resumenDeSeguimiento(NUTRITIONIST_ID, PATIENT_ID, { dias: 7 });

    expect(resumen?.adherencia).toBeNull();
  });

  it('calcula la adherencia contra las comidas del plan activo', async () => {
    const hoy = new Date();
    db.mealPlan.findFirst.mockResolvedValue({
      activadoAt: hoy,
      createdAt: hoy,
      _count: { meals: 3 },
    });
    // Las tres comidas de hoy, el único día evaluado.
    db.mealLog.findMany.mockResolvedValue([{ fecha: hoy }, { fecha: hoy }, { fecha: hoy }]);

    const resumen = await resumenDeSeguimiento(NUTRITIONIST_ID, PATIENT_ID, { dias: 7 });

    expect(resumen?.adherencia).toMatchObject({
      adherencia: 100,
      diasEvaluados: 1,
      comidasEsperadas: 3,
    });
    expect(resumen?.comidasPorDia).toBe(3);
  });

  it('usa createdAt cuando el plan activo no tiene fecha de activación', async () => {
    // Planes anteriores a la migración de la fase 6.
    const hoy = new Date();
    db.mealPlan.findFirst.mockResolvedValue({
      activadoAt: null,
      createdAt: hoy,
      _count: { meals: 2 },
    });

    const resumen = await resumenDeSeguimiento(NUTRITIONIST_ID, PATIENT_ID, { dias: 7 });

    expect(resumen?.planActivoDesde).not.toBeNull();
    expect(resumen?.adherencia?.diasEvaluados).toBe(1);
  });

  it('incluye la tendencia de peso aunque no haya plan activo', async () => {
    db.mealPlan.findFirst.mockResolvedValue(null);
    db.weightLog.findMany.mockResolvedValue([
      { fecha: new Date('2026-07-01T00:00:00Z'), pesoKg: 80.5 },
      { fecha: new Date('2026-07-23T00:00:00Z'), pesoKg: 78.2 },
    ]);

    const resumen = await resumenDeSeguimiento(NUTRITIONIST_ID, PATIENT_ID, { dias: 7 });

    expect(resumen?.peso).toEqual({ inicial: 80.5, actual: 78.2, cambioKg: -2.3 });
  });

  it('devuelve null para un paciente ajeno', async () => {
    db.patient.findFirst.mockResolvedValue(null);

    expect(await resumenDeSeguimiento(OTRO_NUTRIOLOGO, PATIENT_ID, { dias: 7 })).toBeNull();
  });
});

describe('guardarPlanActividad', () => {
  it('crea una versión nueva en vez de sobrescribir la compartida', async () => {
    db.activityPlan.create.mockResolvedValue({ id: 'plan-2' });

    await guardarPlanActividad(NUTRITIONIST_ID, PATIENT_ID, { texto: 'Caminar 30 min', origen: 'IA' });

    expect(db.activityPlan.create).toHaveBeenCalledWith({
      data: { patientId: PATIENT_ID, texto: 'Caminar 30 min', origen: 'IA' },
    });
    expect(db.activityPlan.updateMany).not.toHaveBeenCalled();
  });

  it('nace sin compartir: la IA propone y el nutriólogo aprueba', async () => {
    db.activityPlan.create.mockResolvedValue({ id: 'plan-2' });

    await guardarPlanActividad(NUTRITIONIST_ID, PATIENT_ID, { texto: 'Rutina', origen: 'IA' });

    const { data } = db.activityPlan.create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty('compartidoAt');
  });
});
