/**
 * @jest-environment node
 */
import {
  borrarComida,
  enviarMensaje,
  guardarAgua,
  marcarMensajesLeidos,
  planActividadCompartido,
  planVigente,
  proximasCitas,
  recetasEnviadas,
  registrarComida,
  registrarPeso,
  resumenDeHoy,
  resumenDeProgreso,
} from './repository';

const mockPatientFindUnique = jest.fn();
const mockPatientFindFirst = jest.fn();
const mockPlanFindFirst = jest.fn();
const mockPlanMealFindFirst = jest.fn();
const mockRecipeFindMany = jest.fn();
const mockActivityFindFirst = jest.fn();
const mockMealLogCreate = jest.fn();
const mockMealLogFindMany = jest.fn();
const mockMealLogDeleteMany = jest.fn();
const mockWeightFindMany = jest.fn();
const mockWeightUpsert = jest.fn();
const mockExerciseFindMany = jest.fn();
const mockWaterFindUnique = jest.fn();
const mockWaterFindMany = jest.fn();
const mockWaterUpsert = jest.fn();
const mockPrefFindUnique = jest.fn();
const mockMessageCreate = jest.fn();
const mockMessageUpdateMany = jest.fn();
const mockAppointmentFindMany = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    patient: {
      findUnique: (...a: unknown[]) => mockPatientFindUnique(...a),
      findFirst: (...a: unknown[]) => mockPatientFindFirst(...a),
    },
    mealPlan: { findFirst: (...a: unknown[]) => mockPlanFindFirst(...a) },
    mealPlanMeal: { findFirst: (...a: unknown[]) => mockPlanMealFindFirst(...a) },
    recipe: { findMany: (...a: unknown[]) => mockRecipeFindMany(...a) },
    activityPlan: { findFirst: (...a: unknown[]) => mockActivityFindFirst(...a) },
    mealLog: {
      create: (...a: unknown[]) => mockMealLogCreate(...a),
      findMany: (...a: unknown[]) => mockMealLogFindMany(...a),
      deleteMany: (...a: unknown[]) => mockMealLogDeleteMany(...a),
    },
    weightLog: {
      findMany: (...a: unknown[]) => mockWeightFindMany(...a),
      upsert: (...a: unknown[]) => mockWeightUpsert(...a),
    },
    exerciseLog: { findMany: (...a: unknown[]) => mockExerciseFindMany(...a) },
    waterLog: {
      findUnique: (...a: unknown[]) => mockWaterFindUnique(...a),
      findMany: (...a: unknown[]) => mockWaterFindMany(...a),
      upsert: (...a: unknown[]) => mockWaterUpsert(...a),
    },
    foodPreference: { findUnique: (...a: unknown[]) => mockPrefFindUnique(...a) },
    message: {
      create: (...a: unknown[]) => mockMessageCreate(...a),
      updateMany: (...a: unknown[]) => mockMessageUpdateMany(...a),
    },
    appointment: { findMany: (...a: unknown[]) => mockAppointmentFindMany(...a) },
  },
}));

const PACIENTE_ID = '11111111-1111-4111-8111-111111111111';
const NUTRIOLOGO_ID = '22222222-2222-4222-8222-222222222222';
const COMIDA_PLAN_ID = '33333333-3333-4333-8333-333333333333';

/** Extrae el `where` del primer argumento de la llamada al mock. */
function whereDe(mock: jest.Mock): Record<string, unknown> {
  const [args] = mock.mock.calls[0] as [{ where: Record<string, unknown> }];
  return args.where;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPatientFindUnique.mockResolvedValue({
    nutritionist: { nutritionistProfile: { zonaHoraria: 'America/Mexico_City' } },
  });
  mockPlanFindFirst.mockResolvedValue(null);
  mockMealLogFindMany.mockResolvedValue([]);
  mockWeightFindMany.mockResolvedValue([]);
  mockExerciseFindMany.mockResolvedValue([]);
  mockWaterFindMany.mockResolvedValue([]);
  mockWaterFindUnique.mockResolvedValue(null);
  mockPrefFindUnique.mockResolvedValue(null);
});

describe('lo que el paciente puede ver', () => {
  it('solo lee el plan activo y compartido', async () => {
    await planVigente(PACIENTE_ID);

    expect(whereDe(mockPlanFindFirst)).toEqual({
      patientId: PACIENTE_ID,
      estado: 'ACTIVO',
      compartidoAt: { not: null },
    });
  });

  it('solo lee las recetas enviadas, nunca las sugeridas', async () => {
    mockRecipeFindMany.mockResolvedValue([]);

    await recetasEnviadas(PACIENTE_ID);

    expect(whereDe(mockRecipeFindMany)).toEqual({ patientId: PACIENTE_ID, estado: 'ENVIADA' });
  });

  it('solo lee el plan de actividad compartido', async () => {
    mockActivityFindFirst.mockResolvedValue(null);

    await planActividadCompartido(PACIENTE_ID);

    expect(whereDe(mockActivityFindFirst)).toEqual({
      patientId: PACIENTE_ID,
      compartidoAt: { not: null },
    });
  });

  it('solo lista las citas programadas que aún no ocurren', async () => {
    mockAppointmentFindMany.mockResolvedValue([]);

    await proximasCitas(PACIENTE_ID, 20);

    const where = whereDe(mockAppointmentFindMany);
    expect(where).toMatchObject({ patientId: PACIENTE_ID, estado: 'PROGRAMADA' });
    expect(where.inicio).toHaveProperty('gte');
  });
});

describe('registrarComida', () => {
  beforeEach(() => {
    mockMealLogCreate.mockResolvedValue({ id: 'log-1' });
  });

  it('registra una comida libre sin tocar el plan', async () => {
    const resultado = await registrarComida(PACIENTE_ID, {
      nombre: 'Taco de guisado',
      calorias: 320,
      origen: 'MANUAL',
    });

    expect(resultado?.comida).toEqual({ id: 'log-1' });
    expect(mockPlanMealFindFirst).not.toHaveBeenCalled();
  });

  it('comprueba que la comida del plan sea de este paciente', async () => {
    mockPlanMealFindFirst.mockResolvedValue({ id: COMIDA_PLAN_ID });

    await registrarComida(PACIENTE_ID, {
      meal_plan_meal_id: COMIDA_PLAN_ID,
      nombre: 'Desayuno',
      origen: 'MANUAL',
    });

    expect(whereDe(mockPlanMealFindFirst)).toEqual({
      id: COMIDA_PLAN_ID,
      mealPlan: { patientId: PACIENTE_ID },
    });
  });

  it('rechaza una comida del plan de otro paciente sin escribir nada', async () => {
    mockPlanMealFindFirst.mockResolvedValue(null);

    const resultado = await registrarComida(PACIENTE_ID, {
      meal_plan_meal_id: COMIDA_PLAN_ID,
      nombre: 'Desayuno ajeno',
      origen: 'MANUAL',
    });

    expect(resultado).toBeNull();
    expect(mockMealLogCreate).not.toHaveBeenCalled();
  });

  it('guarda los macros y el origen de la estimación con IA', async () => {
    await registrarComida(PACIENTE_ID, {
      nombre: 'Ensalada',
      calorias: 210,
      proteina_g: 12,
      carbos_g: 18,
      grasa_g: 9,
      origen: 'IA',
    });

    const [{ data }] = mockMealLogCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).toMatchObject({
      patientId: PACIENTE_ID,
      calorias: 210,
      proteinaG: 12,
      origen: 'IA',
    });
  });
});

describe('borrarComida', () => {
  it('filtra por paciente dentro del propio delete', async () => {
    mockMealLogDeleteMany.mockResolvedValue({ count: 1 });

    await expect(borrarComida(PACIENTE_ID, COMIDA_PLAN_ID)).resolves.toBe(true);
    expect(whereDe(mockMealLogDeleteMany)).toEqual({
      id: COMIDA_PLAN_ID,
      patientId: PACIENTE_ID,
    });
  });

  it('devuelve false cuando el registro es de otro paciente', async () => {
    mockMealLogDeleteMany.mockResolvedValue({ count: 0 });

    await expect(borrarComida(PACIENTE_ID, COMIDA_PLAN_ID)).resolves.toBe(false);
  });

  it('no consulta la base con un id que no es UUID', async () => {
    await expect(borrarComida(PACIENTE_ID, 'no-es-uuid')).resolves.toBe(false);
    expect(mockMealLogDeleteMany).not.toHaveBeenCalled();
  });
});

describe('registros idempotentes', () => {
  it('hace upsert del peso por paciente y día', async () => {
    mockWeightUpsert.mockResolvedValue({ id: 'peso-1' });

    await registrarPeso(PACIENTE_ID, { fecha: '2026-07-28', peso_kg: 74.2 });

    const [args] = mockWeightUpsert.mock.calls[0] as [
      { where: { patientId_fecha: { patientId: string; fecha: Date } } },
    ];
    expect(args.where.patientId_fecha.patientId).toBe(PACIENTE_ID);
    expect(args.where.patientId_fecha.fecha.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('guarda el total de vasos, no un incremento', async () => {
    mockWaterUpsert.mockResolvedValue({ id: 'agua-1' });

    await guardarAgua(PACIENTE_ID, { fecha: '2026-07-28', vasos: 5 });

    const [args] = mockWaterUpsert.mock.calls[0] as [
      { create: { vasos: number }; update: { vasos: number } },
    ];
    expect(args.create.vasos).toBe(5);
    expect(args.update.vasos).toBe(5);
  });
});

describe('mensajes', () => {
  it('toma el destinatario del expediente, no de quien llama', async () => {
    mockPatientFindFirst.mockResolvedValue({ nutritionistId: NUTRIOLOGO_ID });
    mockMessageCreate.mockResolvedValue({ id: 'msg-1' });

    await enviarMensaje(PACIENTE_ID, 'Hola');

    const [{ data }] = mockMessageCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).toMatchObject({
      patientId: PACIENTE_ID,
      nutritionistId: NUTRIOLOGO_ID,
      emisor: 'PATIENT',
    });
  });

  it('no escribe si el expediente fue dado de baja', async () => {
    mockPatientFindFirst.mockResolvedValue(null);

    await expect(enviarMensaje(PACIENTE_ID, 'Hola')).resolves.toBeNull();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it('marca como leídos solo los mensajes del nutriólogo', async () => {
    mockMessageUpdateMany.mockResolvedValue({ count: 3 });

    await expect(marcarMensajesLeidos(PACIENTE_ID)).resolves.toBe(3);
    expect(whereDe(mockMessageUpdateMany)).toEqual({
      patientId: PACIENTE_ID,
      emisor: 'NUTRITIONIST',
      leidoAt: null,
    });
  });
});

describe('resumenDeHoy', () => {
  it('no reporta adherencia cuando no hay plan compartido', async () => {
    const resumen = await resumenDeHoy(PACIENTE_ID);

    expect(resumen.plan).toBeNull();
    // null y no 0 %: un cero se leería como abandono del paciente.
    expect(resumen.adherencia).toBeNull();
  });

  it('usa la meta de agua del expediente y cae en 8 si no hay preferencias', async () => {
    const sinPreferencias = await resumenDeHoy(PACIENTE_ID);
    mockPrefFindUnique.mockResolvedValue({ metaAguaVasos: 10 });
    const conPreferencias = await resumenDeHoy(PACIENTE_ID);

    expect(sinPreferencias.agua).toEqual({ vasos: 0, meta: 8 });
    expect(conPreferencias.agua.meta).toBe(10);
  });

  it('calcula adherencia y comidas marcadas contra el plan vigente', async () => {
    const hoy = new Date();
    mockPlanFindFirst.mockResolvedValue({
      id: 'plan-1',
      activadoAt: new Date(hoy.getTime() - 86_400_000),
      createdAt: hoy,
      meals: [{ id: COMIDA_PLAN_ID }, { id: 'comida-2' }],
    });
    mockMealLogFindMany.mockResolvedValue([
      { id: 'log-1', fecha: hoy, mealPlanMealId: COMIDA_PLAN_ID },
    ]);

    const resumen = await resumenDeHoy(PACIENTE_ID);

    expect(resumen.comidasMarcadas).toEqual([COMIDA_PLAN_ID]);
    expect(resumen.adherencia?.comidasRegistradas).toBe(1);
  });

  it('omite de las marcadas los registros libres, que no cuelgan del plan', async () => {
    const hoy = new Date();
    mockPlanFindFirst.mockResolvedValue({
      id: 'plan-1',
      activadoAt: hoy,
      createdAt: hoy,
      meals: [{ id: COMIDA_PLAN_ID }],
    });
    mockMealLogFindMany.mockResolvedValue([{ id: 'log-1', fecha: hoy, mealPlanMealId: null }]);

    const resumen = await resumenDeHoy(PACIENTE_ID);

    expect(resumen.comidasMarcadas).toEqual([]);
    expect(resumen.registros).toHaveLength(1);
  });
});

describe('resumenDeProgreso', () => {
  it('devuelve el catálogo de logros aunque no haya registros', async () => {
    const progreso = await resumenDeProgreso(PACIENTE_ID);

    expect(progreso.logros).toHaveLength(6);
    expect(progreso.peso).toBeNull();
  });

  it('no inventa un peso meta que el modelo no guarda', async () => {
    mockWeightFindMany.mockResolvedValue([
      { id: 'p1', fecha: new Date('2026-06-01'), pesoKg: 80 },
      { id: 'p2', fecha: new Date('2026-07-01'), pesoKg: 77 },
    ]);

    const progreso = await resumenDeProgreso(PACIENTE_ID);

    expect(progreso.peso).toEqual({ inicial: 80, actual: 77, cambioKg: -3 });
    expect(progreso.faltaKg).toBeNull();
    expect(progreso.logros.find((l) => l.id === 'peso_meta')?.progreso).toBe(0);
  });

  it('cuenta como día de agua solo los que alcanzaron la meta', async () => {
    mockPrefFindUnique.mockResolvedValue({ metaAguaVasos: 8 });
    mockWaterFindMany.mockResolvedValue([
      { fecha: new Date('2026-07-27'), vasos: 8 },
      { fecha: new Date('2026-07-26'), vasos: 3 },
    ]);

    const progreso = await resumenDeProgreso(PACIENTE_ID);
    const agua = progreso.logros.find((l) => l.id === 'agua_meta');

    // Un solo día cuenta; el de 3 vasos no llegó a la meta.
    expect(agua?.progreso).toBeLessThanOrEqual(1 / 7 + 0.01);
  });
});
