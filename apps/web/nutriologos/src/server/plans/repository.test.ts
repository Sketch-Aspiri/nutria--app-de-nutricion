import { prisma } from '@/server/db';

import {
  actualizarPlan,
  activarPlan,
  AlergenoEnPlanError,
  AlimentoDePlanNoEncontradoError,
  crearPlan,
  crearPlantilla,
  DesviacionEnergeticaPlanError,
  duplicarPlan,
  EstructuraPlanInvalidaError,
  OPCIONES_TRANSACCION_PLAN,
  PlanNoEditableError,
  PlanIncompletoError,
  VersionPlanObsoletaError,
} from './repository';
import {
  actualizarPlanSchema,
  crearPlanSchema,
  crearPlantillaSchema,
} from './schemas';

jest.mock('@/server/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    patient: { findFirst: jest.fn() },
    mealPlan: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    mealPlanMeal: { deleteMany: jest.fn() },
    food: { findMany: jest.fn() },
    planTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const NUTRITIONIST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PATIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FOOD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TEMPLATE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type MetodoMock = jest.Mock<Promise<unknown>, unknown[]>;
type PrismaMock = {
  $transaction: MetodoMock;
  patient: { findFirst: MetodoMock };
  mealPlan: {
    findFirst: MetodoMock;
    findFirstOrThrow: MetodoMock;
    findUniqueOrThrow: MetodoMock;
    create: MetodoMock;
    update: MetodoMock;
    updateMany: MetodoMock;
  };
  mealPlanMeal: { deleteMany: MetodoMock };
  food: { findMany: MetodoMock };
  planTemplate: {
    findFirst: MetodoMock;
    create: MetodoMock;
    updateMany: MetodoMock;
    findUnique: MetodoMock;
  };
};

const db = prisma as unknown as PrismaMock;

function alimento(overrides: Record<string, unknown> = {}) {
  return {
    id: FOOD_ID,
    nombre: 'Avena',
    nombreNormalizado: 'avena',
    grupoSmae: 'cereales',
    subgrupo: null,
    porcionDescripcion: '1/2 taza',
    porcionGramos: 40,
    energiaKcal: 100,
    proteinaG: 4,
    lipidosG: 2,
    saturadasG: null,
    colesterolMg: null,
    carbohidratosG: 20,
    fibraG: null,
    azucarG: null,
    sodioMg: null,
    potasioMg: null,
    calcioMg: null,
    hierroMg: null,
    acidoFolicoUg: null,
    vitaminaAUg: null,
    vitaminaCMg: null,
    indiceGlicemico: null,
    equivalentes: {},
    imagenUrl: null,
    fuente: 'INCMNSZ',
    fuenteRef: null,
    esPublico: true,
    nutritionistId: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function planDetalle(overrides: Record<string, unknown> = {}) {
  return {
    id: PLAN_ID,
    patientId: PATIENT_ID,
    estado: 'BORRADOR',
    caloriasDiarias: 1_800,
    proteinaG: 100,
    carbosG: 220,
    grasaG: 60,
    nota: null,
    origen: 'MANUAL',
    calculoSnapshot: null,
    compartidoAt: null,
    pdfUrl: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    meals: [],
    ...overrides,
  };
}

describe('repositorio de planes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.$transaction.mockImplementation(
      async (callback: unknown) =>
        (callback as (tx: PrismaMock) => Promise<unknown>)(db),
    );
  });

  it('copia y escala los macros del alimento, ignorando los enviados por el cliente', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.food.findMany.mockResolvedValue([alimento()]);
    db.mealPlan.create.mockResolvedValue(planDetalle());

    const datos = crearPlanSchema.parse({
      calorias_diarias: 1_800,
      proteina_g: 100,
      carbos_g: 220,
      grasa_g: 60,
      comidas: [
        {
          nombre: 'Desayuno',
          items: [
            {
              food_id: FOOD_ID,
              cantidad_porciones: 1.5,
              energia_kcal: 9_999,
              proteina_g: 9_999,
              carbohidratos_g: 9_999,
              lipidos_g: 9_999,
            },
          ],
        },
      ],
    });

    await crearPlan(NUTRITIONIST_ID, PATIENT_ID, datos);

    expect(db.patient.findFirst).toHaveBeenCalledWith({
      where: {
        id: PATIENT_ID,
        nutritionistId: NUTRITIONIST_ID,
        deletedAt: null,
      },
      select: { id: true },
    });
    const create = db.mealPlan.create.mock.calls[0]?.[0] as {
      data: {
        meals: {
          create: Array<{
            items: {
              create: Array<Record<string, unknown>>;
            };
          }>;
        };
      };
    };
    expect(create.data.meals.create[0]?.items.create[0]).toMatchObject({
      cantidadPorciones: 1.5,
      energiaKcal: 150,
      proteinaG: 6,
      carbohidratosG: 30,
      lipidosG: 3,
      food: { connect: { id: FOOD_ID } },
      foodSnapshot: {
        id: FOOD_ID,
        nombre: 'Avena',
        grupo: 'cereales',
        porcion_descripcion: '1/2 taza',
        porcion_gramos: 40,
        imagen_url: null,
      },
    });
  });

  it('escribe el plan con el presupuesto de tiempo ampliado, no con el de 5 s de Prisma', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.food.findMany.mockResolvedValue([alimento()]);
    db.mealPlan.create.mockResolvedValue(planDetalle());

    await crearPlan(
      NUTRITIONIST_ID,
      PATIENT_ID,
      crearPlanSchema.parse({
        calorias_diarias: 1_800,
        proteina_g: 120,
        carbos_g: 200,
        grasa_g: 60,
        comidas: [{ nombre: 'Desayuno', items: [{ food_id: FOOD_ID }] }],
      }),
    );

    // Un plan es un `create` anidado: un INSERT por comida y otro por item. Con
    // el timeout por omisión, un borrador grande contra una base gestionada
    // muere con P2028 y el nutriólogo pierde el trabajo.
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: OPCIONES_TRANSACCION_PLAN.timeout }),
    );
    expect(OPCIONES_TRANSACCION_PLAN.timeout).toBeGreaterThan(5_000);
  });

  it('rechaza un food privado de otro nutriólogo', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.food.findMany.mockResolvedValue([]);

    const datos = crearPlanSchema.parse({
      calorias_diarias: 1_800,
      proteina_g: 100,
      carbos_g: 220,
      grasa_g: 60,
      comidas: [
        {
          nombre: 'Desayuno',
          items: [{ food_id: FOOD_ID }],
        },
      ],
    });

    await expect(
      crearPlan(NUTRITIONIST_ID, PATIENT_ID, datos),
    ).rejects.toBeInstanceOf(AlimentoDePlanNoEncontradoError);
    expect(db.food.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [FOOD_ID] },
        deletedAt: null,
        OR: [
          { esPublico: true, nutritionistId: null },
          { nutritionistId: NUTRITIONIST_ID },
        ],
      },
    });
    expect(db.mealPlan.create).not.toHaveBeenCalled();
  });

  it('hidrata las metas de macros al aplicar una plantilla', async () => {
    db.patient.findFirst.mockResolvedValue({ id: PATIENT_ID });
    db.planTemplate.findFirst.mockResolvedValue({
      id: TEMPLATE_ID,
      calorias: 1_800,
      estructura: {
        comidas: [
          {
            nombre: 'Desayuno',
            items: [
              {
                descripcion_libre: 'Preparación base',
                cantidad_porciones: 1,
                energia_kcal: 1_800,
                proteina_g: 119.6,
                carbohidratos_g: 205.2,
                lipidos_g: 60.4,
              },
            ],
          },
        ],
      },
    });
    db.mealPlan.create.mockResolvedValue(planDetalle());

    await crearPlan(
      NUTRITIONIST_ID,
      PATIENT_ID,
      crearPlanSchema.parse({ plantilla_id: TEMPLATE_ID }),
    );

    expect(db.mealPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caloriasDiarias: 1_800,
          proteinaG: 120,
          carbosG: 205,
          grasaG: 60,
        }),
      }),
    );
  });

  it('duplica SQL NULL sin convertirlo en un snapshot JSON null', async () => {
    db.mealPlan.findFirst.mockResolvedValue(
      planDetalle({ calculoSnapshot: null, meals: [] }),
    );
    db.mealPlan.create.mockResolvedValue(
      planDetalle({ id: 'duplicado', calculoSnapshot: null }),
    );

    await duplicarPlan(NUTRITIONIST_ID, PLAN_ID);

    const create = db.mealPlan.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(create.data).not.toHaveProperty('calculoSnapshot');
  });

  it('editar solo la nota conserva comidas, IDs y snapshots existentes', async () => {
    const updatedAt = new Date('2026-07-20T12:00:00.000Z');
    const existente = planDetalle({
      updatedAt,
      meals: [
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          mealPlanId: PLAN_ID,
          orden: 0,
          nombre: 'Desayuno',
          horario: '08:00',
          descripcion: null,
          items: [
            {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              mealId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              foodId: FOOD_ID,
              descripcionLibre: null,
              cantidadPorciones: 1,
              energiaKcal: 100,
              proteinaG: 4,
              carbohidratosG: 20,
              lipidosG: 2,
            },
          ],
        },
      ],
    });
    db.mealPlan.findFirst.mockResolvedValue(existente);
    db.mealPlan.update.mockResolvedValue(existente);
    db.mealPlan.findUniqueOrThrow.mockResolvedValue(existente);

    await actualizarPlan(
      NUTRITIONIST_ID,
      PLAN_ID,
      actualizarPlanSchema.parse({
        expected_updated_at: updatedAt.toISOString(),
        nota: 'Nueva indicación',
        comidas: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            orden: 0,
            nombre: 'Desayuno',
            horario: '08:00',
            descripcion: null,
            items: [
              {
                id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                food_id: FOOD_ID,
                descripcion_libre: null,
                cantidad_porciones: 1,
                energia_kcal: 100,
                proteina_g: 4,
                carbohidratos_g: 20,
                lipidos_g: 2,
              },
            ],
          },
        ],
      }),
    );

    expect(db.mealPlanMeal.deleteMany).not.toHaveBeenCalled();
    expect(db.food.findMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: expect.objectContaining({
        nota: 'Nueva indicación',
      }),
    });
    expect(
      (db.mealPlan.update.mock.calls[0]?.[0] as { data: { meals?: unknown } })
        .data.meals,
    ).toBeUndefined();
  });

  it('reescala el snapshot original sin releer un food que pudo cambiar', async () => {
    const updatedAt = new Date('2026-07-20T12:00:00.000Z');
    const existente = planDetalle({
      updatedAt,
      meals: [
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          mealPlanId: PLAN_ID,
          orden: 0,
          nombre: 'Desayuno',
          horario: null,
          descripcion: null,
          items: [
            {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              mealId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              foodId: FOOD_ID,
              descripcionLibre: null,
              cantidadPorciones: 1,
              energiaKcal: 100,
              proteinaG: 4,
              carbohidratosG: 20,
              lipidosG: 2,
            },
          ],
        },
      ],
    });
    db.mealPlan.findFirst.mockResolvedValue(existente);
    db.mealPlan.update.mockResolvedValue(existente);
    db.mealPlan.findUniqueOrThrow.mockResolvedValue(existente);

    await actualizarPlan(
      NUTRITIONIST_ID,
      PLAN_ID,
      actualizarPlanSchema.parse({
        expected_updated_at: updatedAt.toISOString(),
        comidas: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            orden: 0,
            nombre: 'Desayuno',
            items: [
              {
                id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                food_id: FOOD_ID,
                cantidad_porciones: 2,
              },
            ],
          },
        ],
      }),
    );

    expect(db.food.findMany).not.toHaveBeenCalled();
    expect(db.mealPlanMeal.deleteMany).toHaveBeenCalledWith({
      where: { mealPlanId: PLAN_ID },
    });
    const update = db.mealPlan.update.mock.calls[0]?.[0] as {
      data: {
        meals: {
          create: Array<{
            items: { create: Array<Record<string, unknown>> };
          }>;
        };
      };
    };
    expect(update.data.meals.create[0]?.items.create[0]).toMatchObject({
      cantidadPorciones: 2,
      energiaKcal: 200,
      proteinaG: 8,
      carbohidratosG: 40,
      lipidosG: 4,
    });
  });

  it('reutiliza el snapshot si el food histórico quedó sin FK por eliminación', async () => {
    const updatedAt = new Date('2026-07-20T12:00:00.000Z');
    const foodSnapshot = {
      id: FOOD_ID,
      nombre: 'Avena histórica',
      grupo: 'cereales',
      porcion_descripcion: '1/2 taza',
      porcion_gramos: 40,
      imagen_url: null,
    };
    const existente = planDetalle({
      updatedAt,
      meals: [
        {
          id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          mealPlanId: PLAN_ID,
          orden: 0,
          nombre: 'Desayuno',
          horario: null,
          descripcion: null,
          items: [
            {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              mealId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              foodId: null,
              foodSnapshot,
              descripcionLibre: null,
              cantidadPorciones: 1,
              energiaKcal: 100,
              proteinaG: 4,
              carbohidratosG: 20,
              lipidosG: 2,
            },
          ],
        },
      ],
    });
    db.mealPlan.findFirst.mockResolvedValue(existente);
    db.mealPlan.update.mockResolvedValue(existente);
    db.mealPlan.findUniqueOrThrow.mockResolvedValue(existente);

    await actualizarPlan(
      NUTRITIONIST_ID,
      PLAN_ID,
      actualizarPlanSchema.parse({
        expected_updated_at: updatedAt.toISOString(),
        comidas: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            orden: 0,
            nombre: 'Desayuno ajustado',
            items: [
              {
                id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
                food_id: FOOD_ID,
                cantidad_porciones: 2,
              },
            ],
          },
        ],
      }),
    );

    expect(db.food.findMany).not.toHaveBeenCalled();
    const update = db.mealPlan.update.mock.calls[0]?.[0] as {
      data: {
        meals: {
          create: Array<{
            items: { create: Array<Record<string, unknown>> };
          }>;
        };
      };
    };
    const item = update.data.meals.create[0]?.items.create[0];
    expect(item).toMatchObject({
      foodSnapshot,
      cantidadPorciones: 2,
      energiaKcal: 200,
    });
    expect(item).not.toHaveProperty('food');
  });

  it('rechaza editar un plan activo para conservar su historial y meal logs', async () => {
    db.mealPlan.findFirst.mockResolvedValue(
      planDetalle({ estado: 'ACTIVO', meals: [] }),
    );

    await expect(
      actualizarPlan(
        NUTRITIONIST_ID,
        PLAN_ID,
        actualizarPlanSchema.parse({
          expected_updated_at: new Date('2026-07-01T00:00:00Z').toISOString(),
          nota: 'No debe persistirse',
        }),
      ),
    ).rejects.toBeInstanceOf(PlanNoEditableError);
    expect(db.mealPlanMeal.deleteMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('rechaza una edición basada en una versión obsoleta', async () => {
    db.mealPlan.findFirst.mockResolvedValue(
      planDetalle({
        updatedAt: new Date('2026-07-20T12:00:00.000Z'),
        meals: [],
      }),
    );

    await expect(
      actualizarPlan(
        NUTRITIONIST_ID,
        PLAN_ID,
        actualizarPlanSchema.parse({
          expected_updated_at: new Date('2026-07-19T12:00:00.000Z').toISOString(),
          nota: 'Versión anterior',
        }),
      ),
    ).rejects.toBeInstanceOf(VersionPlanObsoletaError);
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('rechaza IDs ajenos o duplicados en la estructura recibida', async () => {
    const updatedAt = new Date('2026-07-20T12:00:00.000Z');
    db.mealPlan.findFirst.mockResolvedValue(
      planDetalle({
        updatedAt,
        meals: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            mealPlanId: PLAN_ID,
            orden: 0,
            nombre: 'Desayuno',
            horario: null,
            descripcion: null,
            items: [],
          },
        ],
      }),
    );

    const base = {
      expected_updated_at: updatedAt.toISOString(),
      comidas: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          nombre: 'Comida ajena',
          items: [],
        },
      ],
    };
    await expect(
      actualizarPlan(
        NUTRITIONIST_ID,
        PLAN_ID,
        actualizarPlanSchema.parse(base),
      ),
    ).rejects.toBeInstanceOf(EstructuraPlanInvalidaError);

    await expect(
      actualizarPlan(
        NUTRITIONIST_ID,
        PLAN_ID,
        actualizarPlanSchema.parse({
          expected_updated_at: updatedAt.toISOString(),
          comidas: [
            {
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              nombre: 'Desayuno',
              items: [
                {
                  id: '99999999-9999-4999-8999-999999999999',
                  food_id: FOOD_ID,
                  cantidad_porciones: 1,
                },
              ],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(EstructuraPlanInvalidaError);

    await expect(
      actualizarPlan(
        NUTRITIONIST_ID,
        PLAN_ID,
        actualizarPlanSchema.parse({
          expected_updated_at: updatedAt.toISOString(),
          comidas: [
            {
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              nombre: 'Uno',
              items: [],
            },
            {
              id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
              nombre: 'Dos',
              items: [],
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(EstructuraPlanInvalidaError);
    expect(db.mealPlanMeal.deleteMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('activa en transacción y archiva cualquier activo anterior', async () => {
    db.mealPlan.findFirst.mockResolvedValue({ id: PLAN_ID });
    db.mealPlan.findFirstOrThrow.mockResolvedValue({
      ...planDetalle(),
      patient: {
        foodPreference: { alergias: [] },
      },
      meals: [
        {
          nombre: 'Desayuno',
          descripcion: null,
          items: [
            {
              food: null,
              descripcionLibre: 'Preparación propia',
              energiaKcal: 1_800,
            },
          ],
        },
      ],
    });
    db.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    db.mealPlan.update.mockResolvedValue(
      planDetalle({ estado: 'ACTIVO' }),
    );

    const resultado = await activarPlan(NUTRITIONIST_ID, PLAN_ID);

    expect(resultado).toMatchObject({ id: PLAN_ID, estado: 'ACTIVO' });
    expect(db.mealPlan.updateMany).toHaveBeenCalledWith({
      where: {
        patientId: PATIENT_ID,
        estado: 'ACTIVO',
        id: { not: PLAN_ID },
      },
      data: { estado: 'ARCHIVADO' },
    });
    // `activadoAt` marca desde qué día mide la adherencia (fase 6).
    expect(db.mealPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PLAN_ID },
        data: { estado: 'ACTIVO', activadoAt: expect.any(Date) },
      }),
    );
    // SERIALIZABLE por la garantía de un solo plan activo, y con el presupuesto
    // de tiempo ampliado: el de 5 s por omisión no alcanza para escribir un plan
    // completo contra una base gestionada.
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      ...OPCIONES_TRANSACCION_PLAN,
      isolationLevel: 'Serializable',
    });
  });

  it('bloquea la activación de un plan sin comidas ni items', async () => {
    db.mealPlan.findFirst.mockResolvedValue({ id: PLAN_ID });
    db.mealPlan.findFirstOrThrow.mockResolvedValue({
      ...planDetalle({ caloriasDiarias: 0 }),
      patient: {
        foodPreference: { alergias: [] },
      },
      meals: [],
    });

    await expect(
      activarPlan(NUTRITIONIST_ID, PLAN_ID),
    ).rejects.toBeInstanceOf(PlanIncompletoError);
    expect(db.mealPlan.updateMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('bloquea la activación si la energía se desvía más de ±5% de la meta', async () => {
    db.mealPlan.findFirst.mockResolvedValue({ id: PLAN_ID });
    db.mealPlan.findFirstOrThrow.mockResolvedValue({
      ...planDetalle(),
      patient: {
        foodPreference: { alergias: [] },
      },
      meals: [
        {
          nombre: 'Desayuno',
          descripcion: null,
          items: [
            {
              food: null,
              descripcionLibre: 'Preparación propia',
              energiaKcal: 1_700,
            },
          ],
        },
      ],
    });

    await expect(
      activarPlan(NUTRITIONIST_ID, PLAN_ID),
    ).rejects.toBeInstanceOf(DesviacionEnergeticaPlanError);
    expect(db.mealPlan.updateMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('reintenta una serialización P2034 de forma acotada', async () => {
    db.$transaction
      .mockRejectedValueOnce(
        Object.assign(new Error('serialization'), { code: 'P2034' }),
      )
      .mockImplementation(
        async (callback: unknown) =>
          (callback as (tx: PrismaMock) => Promise<unknown>)(db),
      );
    db.mealPlan.findFirst.mockResolvedValue({ id: PLAN_ID });
    db.mealPlan.findFirstOrThrow.mockResolvedValue({
      ...planDetalle(),
      patient: { foodPreference: { alergias: [] } },
      meals: [
        {
          nombre: 'Desayuno',
          descripcion: null,
          items: [
            {
              food: null,
              descripcionLibre: 'Preparación propia',
              energiaKcal: 1_800,
            },
          ],
        },
      ],
    });
    db.mealPlan.updateMany.mockResolvedValue({ count: 1 });
    db.mealPlan.update.mockResolvedValue(planDetalle({ estado: 'ACTIVO' }));

    await expect(activarPlan(NUTRITIONIST_ID, PLAN_ID)).resolves.toMatchObject({
      estado: 'ACTIVO',
    });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it('bloquea la activación si un alimento menciona una alergia', async () => {
    db.mealPlan.findFirst.mockResolvedValue({ id: PLAN_ID });
    db.mealPlan.findFirstOrThrow.mockResolvedValue({
      ...planDetalle(),
      patient: {
        foodPreference: { alergias: ['Cacahuate'] },
      },
      meals: [
        {
          id: 'meal',
          mealPlanId: PLAN_ID,
          orden: 0,
          nombre: 'Colación',
          horario: null,
          descripcion: null,
          items: [
            {
              food: { nombre: 'Crema de cacahuate' },
              descripcionLibre: null,
              energiaKcal: 1_800,
            },
          ],
        },
      ],
    });

    await expect(
      activarPlan(NUTRITIONIST_ID, PLAN_ID),
    ).rejects.toBeInstanceOf(AlergenoEnPlanError);
    expect(db.mealPlan.updateMany).not.toHaveBeenCalled();
    expect(db.mealPlan.update).not.toHaveBeenCalled();
  });

  it('enriquece la estructura de plantilla con un snapshot autorizado del food', async () => {
    db.food.findMany.mockResolvedValue([alimento()]);
    db.planTemplate.create.mockResolvedValue({
      id: 'template',
      nutritionistId: NUTRITIONIST_ID,
    });
    const datos = crearPlantillaSchema.parse({
      nombre: 'Base',
      objetivo: 'MANTENIMIENTO',
      calorias: 1_800,
      estructura: {
        comidas: [
          {
            nombre: 'Desayuno',
            items: [
              {
                food_id: FOOD_ID,
                food: {
                  id: FOOD_ID,
                  nombre: 'Nombre falsificado',
                  grupo: 'otro',
                  porcion_descripcion: 'otra',
                  porcion_gramos: 1,
                  imagen_url: null,
                },
                cantidad_porciones: 2,
              },
            ],
          },
        ],
      },
    });

    await crearPlantilla(NUTRITIONIST_ID, datos);

    const create = db.planTemplate.create.mock.calls[0]?.[0] as {
      data: {
        estructura: {
          comidas: Array<{
            items: Array<Record<string, unknown>>;
          }>;
        };
      };
    };
    expect(create.data.estructura.comidas[0]?.items[0]).toMatchObject({
      food_id: FOOD_ID,
      food: {
        id: FOOD_ID,
        nombre: 'Avena',
        grupo: 'cereales',
        porcion_descripcion: '1/2 taza',
        porcion_gramos: 40,
      },
      energia_kcal: 200,
      proteina_g: 8,
      carbohidratos_g: 40,
      lipidos_g: 4,
    });
  });
});
