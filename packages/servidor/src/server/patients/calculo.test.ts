/**
 * @jest-environment node
 */
import type { AnthropometryMeasurement } from '@prisma/client';

import { type PacienteParaCalculo, calcularParaPaciente, datosDeCalculo } from './calculo';

/**
 * Datos ficticios: nunca se usan datos reales de pacientes en fixtures
 * (regla del proyecto para datos de salud).
 */
function medicion(overrides: Partial<AnthropometryMeasurement> = {}): AnthropometryMeasurement {
  return {
    id: 'm1',
    patientId: 'p1',
    fecha: new Date('2026-07-20'),
    pesoKg: null,
    alturaCm: null,
    cinturaCm: null,
    caderaCm: null,
    grasaPct: null,
    musculoPct: null,
    pliegues: null,
    createdAt: new Date('2026-07-20'),
    ...overrides,
  } as AnthropometryMeasurement;
}

function paciente(overrides: Partial<PacienteParaCalculo> = {}): PacienteParaCalculo {
  return {
    id: 'p1',
    nutritionistId: 'n1',
    userId: null,
    nombre: 'Paciente Prueba',
    fechaNacimiento: new Date('1992-01-15'),
    genero: 'FEMENINO',
    email: null,
    telefono: null,
    fotoUrl: null,
    estado: 'ACTIVO',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    medicalRecord: {
      id: 'e1',
      patientId: 'p1',
      condiciones: ['Hipertensión'],
      antecedentes: null,
      medicamentos: null,
      nivelActividad: 'LIGERO',
      objetivo: 'PERDIDA_DE_GRASA',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    measurements: [medicion({ pesoKg: 78.5, alturaCm: 162, cinturaCm: 92, caderaCm: 104 })],
    ...overrides,
  } as PacienteParaCalculo;
}

describe('datosDeCalculo', () => {
  it('traduce los enums de la base a las etiquetas de las fórmulas', () => {
    const datos = datosDeCalculo(paciente(), {});

    expect(datos.genero).toBe('Femenino');
    expect(datos.nivelActividad).toBe('Ligero');
    expect(datos.objetivo).toBe('Pérdida de grasa');
    expect(datos.condiciones).toEqual(['Hipertensión']);
  });

  it('deriva la edad de la fecha de nacimiento, no de un campo almacenado', () => {
    const datos = datosDeCalculo(paciente(), {});

    expect(datos.edad).toBeGreaterThan(30);
    expect(datos.edad).toBeLessThan(40);
  });

  it('toma peso y circunferencias de la medición más reciente', () => {
    const datos = datosDeCalculo(paciente(), {});

    expect(datos.peso).toBe(78.5);
    expect(datos.cintura).toBe(92);
    expect(datos.cadera).toBe(104);
  });

  it('arrastra la altura de una toma anterior si la última no la registró', () => {
    const datos = datosDeCalculo(
      paciente({
        measurements: [
          medicion({ id: 'm2', fecha: new Date('2026-07-20'), pesoKg: 76 }),
          medicion({ id: 'm1', fecha: new Date('2026-01-20'), pesoKg: 80, alturaCm: 162 }),
        ],
      }),
      {},
    );

    expect(datos.peso).toBe(76);
    expect(datos.altura).toBe(162);
  });

  it('recoge los pliegues de la última plicometría registrada', () => {
    const datos = datosDeCalculo(
      paciente({
        measurements: [
          medicion({ id: 'm2', fecha: new Date('2026-07-20'), pesoKg: 76, alturaCm: 162 }),
          medicion({
            id: 'm1',
            fecha: new Date('2026-01-20'),
            pliegues: { tricipital: 22, bicipital: 12, subescapular: 24, suprailiaco: 26 },
          }),
        ],
      }),
      {},
    );

    expect(datos.pliegues).toEqual({
      tricipital: 22,
      bicipital: 12,
      subescapular: 24,
      suprailiaco: 26,
    });
  });

  it('descarta un jsonb de pliegues con valores no numéricos', () => {
    const datos = datosDeCalculo(
      paciente({
        measurements: [
          medicion({
            pesoKg: 78,
            alturaCm: 162,
            pliegues: { tricipital: 'veinte' } as never,
          }),
        ],
      }),
      {},
    );

    expect(datos.pliegues).toBeNull();
  });

  it('deja peso y altura en cero cuando no hay mediciones, para que el cálculo falle', () => {
    const datos = datosDeCalculo(paciente({ measurements: [] }), {});

    expect(datos.peso).toBe(0);
    expect(datos.altura).toBe(0);
  });

  it('traslada las opciones del nutriólogo tal como llegaron validadas', () => {
    const datos = datosDeCalculo(paciente(), {
      ecuacion: 'harris_benedict',
      modo_proteina: 'g_por_kg',
      proteina_g_por_kg: 1.6,
      usar_peso_ajustado: true,
      minimos_equivalentes: { verduras: 5 },
    });

    expect(datos.ecuacion).toBe('harris_benedict');
    expect(datos.modoProteina).toBe('g_por_kg');
    expect(datos.proteinaGPorKg).toBe(1.6);
    expect(datos.usarPesoAjustado).toBe(true);
    expect(datos.minimosEquivalentes).toEqual({ verduras: 5 });
  });
});

describe('calcularParaPaciente', () => {
  it('produce un snapshot completo desde el expediente guardado', () => {
    const snapshot = calcularParaPaciente(paciente(), {});

    expect(snapshot.resultado.objetivoCalorias).toBeGreaterThan(0);
    expect(snapshot.antropometria.imc).toBeCloseTo(29.9, 1);
    expect(snapshot.equivalentes.renglones.length).toBeGreaterThan(0);
    expect(snapshot.comparativa).toHaveLength(4);
  });

  it('falla con EXPEDIENTE_INCOMPLETO si el paciente no tiene medidas', () => {
    expect(() => calcularParaPaciente(paciente({ measurements: [] }), {})).toThrow(
      'EXPEDIENTE_INCOMPLETO',
    );
  });

  it('falla con EXPEDIENTE_INCOMPLETO si falta la fecha de nacimiento', () => {
    expect(() => calcularParaPaciente(paciente({ fechaNacimiento: null }), {})).toThrow(
      'EXPEDIENTE_INCOMPLETO',
    );
  });
});
