/**
 * @jest-environment node
 */
import { prisma } from '@/server/db';

import {
  cargarContextoCoach,
  limpiarTextoDelPaciente,
  recetaEnviadaDelPaciente,
} from './contextoPaciente';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    mealPlan: { findFirst: jest.fn() },
    recipe: { findFirst: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  patient: { findFirst: jest.Mock };
  mealPlan: { findFirst: jest.Mock };
  recipe: { findFirst: jest.Mock };
};

const PACIENTE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const RECETA_ID = 'a1b2c3d4-0000-4000-8000-000000000002';

const PACIENTE = {
  id: PACIENTE_ID,
  nombre: 'Ana Gómez',
  email: 'ana@ejemplo.mx',
  telefono: '5512345678',
  medicalRecord: { objetivo: 'PERDIDA_DE_GRASA', objetivoOtro: null },
  foodPreference: {
    alergias: ['Cacahuate'],
    tipoDieta: 'Sin lactosa',
    disgustos: 'Brócoli',
    comidasPorDia: 4,
  },
};

const PLAN = { caloriasDiarias: 1800, proteinaG: 120, carbosG: 180, grasaG: 60 };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.patient.findFirst.mockResolvedValue(PACIENTE);
  mockPrisma.mealPlan.findFirst.mockResolvedValue(PLAN);
});

describe('cargarContextoCoach', () => {
  it('arma el contexto con objetivo, metas, alergias y preferencias', async () => {
    const contexto = await cargarContextoCoach(PACIENTE_ID);

    expect(contexto).toMatchObject({
      patientId: PACIENTE_ID,
      metas: { calorias: 1800, proteinaG: 120, carbosG: 180, grasaG: 60 },
      alergias: ['Cacahuate'],
      tipoDieta: 'Sin lactosa',
      disgustos: 'Brócoli',
      comidasPorDia: 4,
    });
  });

  it('no expone datos clínicos del expediente', async () => {
    const contexto = await cargarContextoCoach(PACIENTE_ID);

    // La ficha del coach no debe poder crecer sin decisión explícita: si alguien
    // agrega antecedentes o medicamentos, este test lo delata.
    expect(Object.keys(contexto ?? {}).sort()).toEqual([
      'alergias',
      'comidasPorDia',
      'disgustos',
      'identificadores',
      'metas',
      'objetivo',
      'patientId',
      'tipoDieta',
    ]);
  });

  it('solo lee del expediente los campos del contexto del coach', async () => {
    await cargarContextoCoach(PACIENTE_ID);

    const select = mockPrisma.patient.findFirst.mock.calls[0][0].select;
    expect(select.medicalRecord.select).toEqual({ objetivo: true, objetivoOtro: true });
    expect(select).not.toHaveProperty('measurements');
  });

  it('devuelve metas nulas cuando no hay plan compartido, en vez de ceros', async () => {
    mockPrisma.mealPlan.findFirst.mockResolvedValue(null);

    await expect(cargarContextoCoach(PACIENTE_ID)).resolves.toMatchObject({ metas: null });
  });

  it('lee solo el plan activo y compartido', async () => {
    await cargarContextoCoach(PACIENTE_ID);

    expect(mockPrisma.mealPlan.findFirst.mock.calls[0][0].where).toMatchObject({
      patientId: PACIENTE_ID,
      estado: 'ACTIVO',
      compartidoAt: { not: null },
    });
  });

  it('seudonimiza el texto libre del expediente', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      ...PACIENTE,
      medicalRecord: { objetivo: 'OTRO', objetivoOtro: 'Lo que Ana quiere lograr' },
      foodPreference: { ...PACIENTE.foodPreference, disgustos: 'Nada que le guste a Ana' },
    });

    const contexto = await cargarContextoCoach(PACIENTE_ID);

    expect(contexto?.objetivo).not.toMatch(/Ana/i);
    expect(contexto?.disgustos).not.toMatch(/Ana/i);
  });

  it('sobrevive a un expediente sin ficha médica ni preferencias', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      ...PACIENTE,
      medicalRecord: null,
      foodPreference: null,
    });

    await expect(cargarContextoCoach(PACIENTE_ID)).resolves.toMatchObject({
      objetivo: 'sin registrar',
      alergias: [],
      comidasPorDia: 3,
    });
  });

  it('devuelve null si el expediente está borrado', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(cargarContextoCoach(PACIENTE_ID)).resolves.toBeNull();
  });

  it('no consulta la base con un identificador mal formado', async () => {
    await expect(cargarContextoCoach('no-es-uuid')).resolves.toBeNull();
    expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
  });
});

describe('limpiarTextoDelPaciente', () => {
  it('borra el nombre y el contacto del texto que escribe el paciente', async () => {
    const contexto = await cargarContextoCoach(PACIENTE_ID);

    const limpio = limpiarTextoDelPaciente(
      'Soy Ana Gómez, escríbeme a ana@ejemplo.mx',
      contexto!,
    );

    expect(limpio).not.toMatch(/Ana/i);
    expect(limpio).not.toContain('ana@ejemplo.mx');
  });
});

describe('recetaEnviadaDelPaciente', () => {
  it('exige que la receta sea del paciente y esté enviada', async () => {
    mockPrisma.recipe.findFirst.mockResolvedValue({
      nombre: 'Ensalada',
      ingredientes: ['lechuga', 'jitomate'],
    });

    await expect(recetaEnviadaDelPaciente(PACIENTE_ID, RECETA_ID)).resolves.toEqual({
      nombre: 'Ensalada',
      ingredientes: ['lechuga', 'jitomate'],
    });
    expect(mockPrisma.recipe.findFirst.mock.calls[0][0].where).toEqual({
      id: RECETA_ID,
      patientId: PACIENTE_ID,
      estado: 'ENVIADA',
    });
  });

  it('devuelve null cuando la receta no es suya o sigue en borrador', async () => {
    mockPrisma.recipe.findFirst.mockResolvedValue(null);

    await expect(recetaEnviadaDelPaciente(PACIENTE_ID, RECETA_ID)).resolves.toBeNull();
  });

  it('tolera un JSON de ingredientes corrupto', async () => {
    mockPrisma.recipe.findFirst.mockResolvedValue({ nombre: 'Ensalada', ingredientes: null });

    await expect(recetaEnviadaDelPaciente(PACIENTE_ID, RECETA_ID)).resolves.toMatchObject({
      ingredientes: [],
    });
  });

  it('no consulta la base con un identificador mal formado', async () => {
    await expect(recetaEnviadaDelPaciente(PACIENTE_ID, 'x')).resolves.toBeNull();
    expect(mockPrisma.recipe.findFirst).not.toHaveBeenCalled();
  });
});
