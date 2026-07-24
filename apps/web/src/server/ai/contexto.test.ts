/**
 * @jest-environment node
 */
import { prisma } from '@/server/db';

import {
  cargarCatalogoAlimentos,
  cargarContextoPaciente,
  limpiarTextoDelNutriologo,
} from './contexto';

jest.mock('@/server/db', () => ({
  prisma: {
    patient: { findFirst: jest.fn() },
    food: { groupBy: jest.fn(), findMany: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  patient: { findFirst: jest.Mock };
  food: { groupBy: jest.Mock; findMany: jest.Mock };
};

const NUTRITIONIST_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const PATIENT_ID = 'b1b2c3d4-0000-4000-8000-000000000002';

/** Paciente ficticio con identificadores sembrados en todos los textos libres. */
const PACIENTE = {
  id: PATIENT_ID,
  nombre: 'María Fernanda López',
  email: 'maria.lopez@correo.mx',
  telefono: '5512345678',
  fechaNacimiento: new Date('1992-03-15'),
  genero: 'FEMENINO',
  medicalRecord: {
    condiciones: ['Hipotiroidismo', 'María reporta gastritis'],
    antecedentes: 'María López, mamá diabética, contacto 5598765432',
    medicamentos: 'Levotiroxina 50 mcg',
    nivelActividad: 'MODERADO',
    objetivo: 'OTRO',
    objetivoOtro: 'Que María llegue a la boda de su hermana',
  },
  foodPreference: {
    tipoDieta: 'Dieta que María sigue con su nutrióloga anterior',
    alergias: ['Nuez'],
    disgustos: 'A María no le gusta el brócoli',
    comidasPorDia: 4,
  },
  measurements: [{ pesoKg: 68.5, alturaCm: 162 }],
  mealPlans: [
    {
      calculoSnapshot: {
        resultado: {
          ecuacion: 'mifflin',
          objetivoCalorias: 1_850.4,
          proteina_g: 120.2,
          carbos_g: 190.7,
          grasa_g: 61.3,
        },
      },
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.patient.findFirst.mockResolvedValue(PACIENTE);
});

describe('cargarContextoPaciente — autorización', () => {
  it('filtra por nutritionistId dentro de la misma consulta', async () => {
    await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(mockPrisma.patient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PATIENT_ID, nutritionistId: NUTRITIONIST_ID, deletedAt: null },
      }),
    );
  });

  it('devuelve null sin consultar cuando el identificador no es UUID', async () => {
    await expect(cargarContextoPaciente(NUTRITIONIST_ID, 'no-es-uuid')).resolves.toBeNull();
    expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('devuelve null cuando el paciente es de otro nutriólogo', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue(null);

    await expect(cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID)).resolves.toBeNull();
  });
});

describe('cargarContextoPaciente — seudonimización', () => {
  it('no expone el nombre, el correo ni el teléfono en ningún campo', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    const serializado = JSON.stringify(contexto);
    expect(serializado).not.toContain('María');
    expect(serializado).not.toContain('López');
    expect(serializado).not.toContain('maria.lopez@correo.mx');
    expect(serializado).not.toContain('5512345678');
    expect(serializado).not.toContain('5598765432');
  });

  it('limpia los antecedentes y el teléfono de un tercero', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    // Nombre y apellido se sustituyen por separado, así que "María López"
    // queda como dos marcadores. Redactar de más es el lado seguro del error.
    expect(contexto?.antecedentes).toBe(
      '[PACIENTE] [PACIENTE], mamá diabética, contacto [TELEFONO]',
    );
  });

  it('limpia el objetivo capturado como texto libre', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto?.objetivo).toContain('[PACIENTE]');
  });

  it('limpia el tipo de dieta, los disgustos y las condiciones capturados a mano', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto?.tipoDieta).toContain('[PACIENTE]');
    expect(contexto?.disgustos).toContain('[PACIENTE]');
    expect(contexto?.condiciones).toContain('[PACIENTE] reporta gastritis');
  });

  it('conserva los datos clínicos que el cálculo sí necesita', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto).toMatchObject({
      genero: 'Femenino',
      nivelActividad: 'Moderado',
      pesoKg: 68.5,
      alturaCm: 162,
      comidasPorDia: 4,
      alergias: ['Nuez'],
      medicamentos: 'Levotiroxina 50 mcg',
    });
    expect(contexto?.edad).toBeGreaterThan(30);
  });
});

describe('cargarContextoPaciente — meta energética', () => {
  it('redondea la meta del último snapshot guardado', async () => {
    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto?.meta).toEqual({
      calorias: 1_850,
      proteinaG: 120,
      carbosG: 191,
      grasaG: 61,
      ecuacion: 'mifflin',
    });
  });

  it('devuelve meta nula cuando el paciente no tiene plan con cálculo', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({ ...PACIENTE, mealPlans: [] });

    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto?.meta).toBeNull();
  });

  it('ignora un snapshot corrupto en lugar de propagar valores indefinidos', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      ...PACIENTE,
      mealPlans: [{ calculoSnapshot: { resultado: { ecuacion: 'mifflin' } } }],
    });

    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto?.meta).toBeNull();
  });
});

describe('cargarContextoPaciente — expediente incompleto', () => {
  it('no revienta cuando faltan expediente, preferencias y mediciones', async () => {
    mockPrisma.patient.findFirst.mockResolvedValue({
      ...PACIENTE,
      fechaNacimiento: null,
      medicalRecord: null,
      foodPreference: null,
      measurements: [],
      mealPlans: [],
    });

    const contexto = await cargarContextoPaciente(NUTRITIONIST_ID, PATIENT_ID);

    expect(contexto).toMatchObject({
      edad: null,
      objetivo: 'sin registrar',
      nivelActividad: 'sin registrar',
      condiciones: [],
      alergias: [],
      comidasPorDia: 3,
      pesoKg: null,
    });
  });
});

describe('cargarCatalogoAlimentos', () => {
  it('reparte el cupo entre los grupos SMAE y solo ofrece alimentos accesibles', async () => {
    mockPrisma.food.groupBy.mockResolvedValue([
      { grupoSmae: 'cereales' },
      { grupoSmae: 'verduras' },
    ]);
    mockPrisma.food.findMany.mockResolvedValue([]);

    await cargarCatalogoAlimentos(NUTRITIONIST_ID, 10);

    expect(mockPrisma.food.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.food.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          deletedAt: null,
          OR: [{ esPublico: true, nutritionistId: null }, { nutritionistId: NUTRITIONIST_ID }],
        }),
      }),
    );
  });

  it('devuelve una lista vacía cuando no hay alimentos', async () => {
    mockPrisma.food.groupBy.mockResolvedValue([]);

    await expect(cargarCatalogoAlimentos(NUTRITIONIST_ID)).resolves.toEqual([]);
    expect(mockPrisma.food.findMany).not.toHaveBeenCalled();
  });

  it('respeta el tope total aunque los grupos devuelvan de más', async () => {
    mockPrisma.food.groupBy.mockResolvedValue([{ grupoSmae: 'cereales' }]);
    mockPrisma.food.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, indice) => ({
        id: `f1b2c3d4-0000-4000-8000-00000000000${indice}`,
        nombre: `Alimento ${indice}`,
        grupoSmae: 'cereales',
        porcionDescripcion: '1 pieza',
        porcionGramos: 30,
        imagenUrl: null,
        energiaKcal: 70,
        proteinaG: 2,
        carbohidratosG: 14,
        lipidosG: 1,
      })),
    );

    await expect(cargarCatalogoAlimentos(NUTRITIONIST_ID, 3)).resolves.toHaveLength(3);
  });
});

describe('limpiarTextoDelNutriologo', () => {
  it('quita los identificadores del texto que escribe el nutriólogo', () => {
    const limpio = limpiarTextoDelNutriologo('María pesa 68 kg y bajó 2 kg', {
      nombre: 'María Fernanda López',
    });

    expect(limpio).toBe('[PACIENTE] pesa 68 kg y bajó 2 kg');
  });
});
